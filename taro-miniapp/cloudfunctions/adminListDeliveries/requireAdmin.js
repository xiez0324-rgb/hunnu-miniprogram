const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function requireAdmin(event) {
  // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
  const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
  const ctx = cloud.getWXContext()
  const token = body.token || ''
  const uid = (body.userInfo && body.userInfo.uid) || ''
  const openid = ctx.OPENID

  const col = db.collection('admins')

  if (token) {
    const res = await col.where({ currentToken: token, enabled: true }).limit(1).get()
    if (res.data.length > 0) return res.data[0]
  }
  if (uid) {
    const res = await col.where({ uid, enabled: true }).limit(1).get()
    if (res.data.length > 0) return res.data[0]
  }
  if (openid) {
    const res = await col.where({ openid, enabled: true }).limit(1).get()
    if (res.data.length > 0) return res.data[0]
  }

  const err = new Error('无管理员权限')
  err.code = 'FORBIDDEN'
  throw err
}

module.exports = { requireAdmin }
