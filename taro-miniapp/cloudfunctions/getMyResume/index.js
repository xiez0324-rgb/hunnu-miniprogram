const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    // 老师端编辑页回填：查询当前老师已保存的简历（不存在返回 null）
    const res = await db.collection('resumes').where({ _openid: openid }).orderBy('updateTime', 'desc').limit(1).get()
    const resume = res.data[0] || null
    return { code: 0, message: 'success', data: { resume } }
  } catch (err) {
    console.error('[getMyResume] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
