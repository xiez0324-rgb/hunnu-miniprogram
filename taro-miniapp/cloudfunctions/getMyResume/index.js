const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 同一账号可能有多条「已通过」认证记录：取「已颁发编号的正式档案」，
// 保证老师端看到的编号/实名与家长端一致
function pickCanonicalVerify(records) {
  const list = (records || []).slice().sort((a, b) => {
    const ta = Date.parse((a && a.reviewTime) || 0) || 0
    const tb = Date.parse((b && b.reviewTime) || 0) || 0
    return tb - ta
  })
  if (!list.length) return null
  return list.find((v) => v.teacherNo) || list.find((v) => !v.superseded) || list[0]
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    // 老师端编辑页回填：查询当前老师已保存的简历（不存在返回 null）
    const [res, uRes, vRes] = await Promise.all([
      db.collection('resumes').where({ _openid: openid }).orderBy('updateTime', 'desc').limit(1).get(),
      db.collection('teacher_users').where({ _openid: openid }).limit(1).get().catch(() => ({ data: [] })),
      db.collection('verifications').where({ _openid: openid, status: '已通过' }).limit(10).get().catch(() => ({ data: [] })),
    ])
    const resume = res.data[0] || null
    const userDoc = uRes.data[0] || null
    const verify = pickCanonicalVerify(vRes.data)
    // 基础身份信息（简历页展示：性别 + 专属编号，随简历一并下发）
    const profile = {
      gender: (userDoc && userDoc.gender) || '',
      teacherNo: (verify && verify.teacherNo) || (userDoc && userDoc.teacherNo) || '',
    }
    return { code: 0, message: 'success', data: { resume, profile } }
  } catch (err) {
    console.error('[getMyResume] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
