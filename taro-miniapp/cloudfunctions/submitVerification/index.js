const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[submitVerification] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
