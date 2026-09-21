const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { checkTexts, SCENE } = require('./contentCheck')

// 平台唯一合作院校：老师端已移除学校选择/填写入口，后端强制落库该名称，
// 仅保留当前院校的学籍数据处理能力（后续多校功能从归档分支恢复时再放开）。
const PARTNER_SCHOOL = '湖南师范大学'

function normText(v, max) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { name, college, major, materials, authorized } = event

    const nameT = normText(name, 20)
    const collegeT = normText(college, 30)
    const majorT = normText(major, 30)
    if (!nameT) return { code: -1, message: '请填写真实姓名', data: null }
    if (!collegeT) return { code: -1, message: '请填写学院名称', data: null }
    if (!majorT) return { code: -1, message: '请填写专业名称', data: null }
    if (!Array.isArray(materials) || materials.length < 1) {
      return { code: -1, message: '请至少上传 1 张学籍材料照片', data: null }
    }
    // 材料仅接受 { name, fileID } 形态，防止写入无法预览的脏数据
    const materialsSafe = materials
      .filter((m) => m && typeof m === 'object' && m.fileID)
      .slice(0, 10)
      .map((m) => ({ name: normText(m.name, 20) || '材料图片', fileID: String(m.fileID) }))
    if (!materialsSafe.length) {
      return { code: -1, message: '材料照片上传不完整，请重新上传', data: null }
    }

    // 内容安全检测：姓名/学院/专业属资料类文本，先做违规内容过滤
    const riskMsg = await checkTexts([nameT, collegeT, majorT], openid, SCENE.资料)
    if (riskMsg) {
      return { code: -1, message: riskMsg, data: null }
    }

    // 防重复提交：存在「待审核」或「已通过」记录时不允许再次提交
    // （待审核=临时锁定；已通过=正式档案固定，仅管理员可发起合规修改）
    const existing = await db
      .collection('verifications')
      .where({ _openid: openid, status: _.in(['待审核', '已通过']) })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }))
    if (existing.data.length > 0) {
      const cur = existing.data[0]
      return {
        code: -1,
        message:
          cur.status === '已通过'
            ? '实名学籍认证已通过，学籍信息已固定，如需修改请联系平台代理人'
            : '认证资料审核中，暂不可重复提交',
        data: null,
      }
    }

    // 留存「本次提交前」的历史实名学籍信息：
    // - 优先级：上一份已通过认证（正式档案）> teacher_users 的锁定实名档案
    // - 目的：驳回时清空本次提交内容后，平台仍可追溯此前的合法实名记录
    let prevProfile = null
    try {
      const [pvRes, puRes] = await Promise.all([
        db.collection('verifications')
          .where({ _openid: openid, status: '已通过' })
          .orderBy('reviewTime', 'desc')
          .limit(1)
          .get()
          .catch(() => ({ data: [] })),
        db.collection('teacher_users')
          .where({ _openid: openid })
          .limit(1)
          .get()
          .catch(() => ({ data: [] })),
      ])
      const prev = pvRes.data[0] || null
      const userDoc = puRes.data[0] || null
      if (prev) {
        prevProfile = {
          name: prev.name || '',
          school: prev.school || PARTNER_SCHOOL,
          college: prev.college || '',
          major: prev.major || '',
          teacherNo: prev.teacherNo || '',
          source: '上份已通过认证',
        }
      } else if (userDoc && userDoc.realName && userDoc.realName.name) {
        prevProfile = {
          name: userDoc.realName.name || '',
          school: userDoc.realName.school || PARTNER_SCHOOL,
          college: userDoc.realName.college || '',
          major: userDoc.realName.major || '',
          teacherNo: userDoc.teacherNo || '',
          source: '账号锁定实名档案',
        }
      }
    } catch (e) {
      console.warn('[submitVerification] 读取历史实名信息失败', e)
    }

    await db.collection('verifications').add({
      data: {
        _openid: openid,
        name: nameT,
        school: PARTNER_SCHOOL, // 固定合作院校，忽略客户端传入的任何学校值
        college: collegeT,
        major: majorT,
        materials: materialsSafe,
        authorized: !!authorized,
        status: '待审核',
        archived: false,
        cleared: false,
        prevProfile, // 提交前的历史实名学籍快照（仅用于追溯/回退）
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[submitVerification] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
