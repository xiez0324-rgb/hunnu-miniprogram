const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')
const { allocateTeacherNo } = require('./allocateTeacherNo')

// 平台唯一合作院校（与 submitVerification 保持一致）
const PARTNER_SCHOOL = '湖南师范大学'

/**
 * 解析该账号（openid）已有的专属编号。
 * 编号是「账号」级属性：一个账号只允许一个编号，且不得因重复审核而变更。
 * 优先取账号档案，其次取历史已通过认证记录上的编号。
 */
async function resolveAccountTeacherNo(openid) {
  if (!openid) return ''
  try {
    const uRes = await db.collection('teacher_users').where({ _openid: openid }).limit(1).get()
    const u = uRes.data[0] || null
    if (u && u.teacherNo) return String(u.teacherNo)
  } catch (e) {
    /* 忽略 */
  }
  try {
    const vRes = await db
      .collection('verifications')
      .where({ _openid: openid, status: '已通过', teacherNo: _.neq('') })
      .limit(1)
      .get()
    const v = vRes.data[0] || null
    if (v && v.teacherNo) return String(v.teacherNo)
  } catch (e) {
    /* 忽略 */
  }
  return ''
}

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { verificationId, action, rejectReason } = body
    if (!verificationId) return { code: -1, message: '缺少认证记录 ID', data: null }
    if (action !== '通过' && action !== '驳回') {
      return { code: -1, message: 'action 仅支持 通过/驳回', data: null }
    }

    let verify = null
    try {
      const r = await db.collection('verifications').doc(verificationId).get()
      verify = r.data || null
    } catch (e) {
      return { code: -1, message: '认证记录不存在', data: null }
    }
    if (verify.status !== '待审核') {
      return { code: -1, message: '该认证已处理过，请刷新列表', data: null }
    }

    let teacherNo = ''

    if (action === '通过') {
      // 1) 专属编号是「账号」级属性：
      //    优先复用本记录已有编号 → 再复用该账号已有编号 → 都没有才新分配，
      //    避免同账号二次审核被重新编号（曾导致「我的」页与正式档案编号不一致）。
      teacherNo =
        verify.teacherNo ||
        (await resolveAccountTeacherNo(verify._openid)) ||
        (await allocateTeacherNo())

      // 2) 同一账号只保留一个有效编号：其它已通过的历史记录标记为「已被新认证取代」并释放编号
      if (verify._openid) {
        await db
          .collection('verifications')
          .where({ _openid: verify._openid, status: '已通过', _id: _.neq(verificationId) })
          .update({ data: { teacherNo: '', superseded: true } })
          .catch((e) => console.warn('[adminReviewVerify] 归一化历史编号失败', e))
      }

      // 3) 本次提交的实名学籍信息固定为不可修改的正式档案（archived / locked）
      await db.collection('verifications').doc(verificationId).update({
        data: {
          status: '已通过',
          archived: true, // 固化为正式档案，仅管理员可发起合规修改
          locked: true,
          teacherNo,
          reviewer: admin.username,
          reviewTime: db.serverDate(),
          rejectReason: '',
        },
      })

      const realName = {
        name: verify.name || '',
        school: verify.school || PARTNER_SCHOOL,
        college: verify.college || '',
        major: verify.major || '',
      }

      // 4) 写回老师账号：锁定实名档案 + 绑定专属编号
      if (verify._openid) {
        await db
          .collection('teacher_users')
          .where({ _openid: verify._openid })
          .update({
            data: {
              realName,
              realNameLocked: true,
              realNameVerifiedAt: db.serverDate(),
              teacherNo,
              verified: true,
              updateTime: db.serverDate(),
            },
          })
          .catch((e) => console.warn('[adminReviewVerify] 写回老师账号失败', e))

        // 4) 同步该老师所有报名快照：认证标志 + 专属编号（已授权时同步实名/学院/专业）
        const snapUpdate = { verified: true, teacherNo }
        if (verify.authorized) {
          snapUpdate.name = realName.name
          snapUpdate.college = realName.college
          snapUpdate.major = realName.major
        }
        await db
          .collection('applications')
          .where({ _openid: verify._openid })
          .update({ data: snapUpdate })
          .catch((e) => console.warn('[adminReviewVerify] 更新报名快照失败', e))
      }
    } else {
      // 驳回：立即清空本次提交的所有实名学籍信息（姓名/学院/专业/材料）。
      // 提交前的历史实名档案（prevProfile / 账号已锁定实名）不受影响，仅本次提交内容被清空。
      await db.collection('verifications').doc(verificationId).update({
        data: {
          status: '已驳回',
          name: '',
          college: '',
          major: '',
          materials: [],
          cleared: true,
          archived: false,
          locked: false,
          reviewer: admin.username,
          reviewTime: db.serverDate(),
          rejectReason: rejectReason || '资料不完整，请补充后重新提交',
        },
      })
    }

    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action: action === '通过' ? 'verify_pass' : 'verify_reject',
        detail: { verificationId, openid: verify._openid, rejectReason: rejectReason || '', teacherNo },
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true, action, teacherNo } }
  } catch (err) {
    console.error('[adminReviewVerify] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
