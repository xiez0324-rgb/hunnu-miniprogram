const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 家长/老师档案分表读取
const ROLE_TABLE = {
  parent: 'parent_users',
  teacher: 'teacher_users',
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    // 兼容 { name, data } 包装
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    // role 必须显式指定：不同身份查不同表，杜绝跨表命中
    const role = body.role === 'parent' ? 'parent' : 'teacher'
    const users = db.collection(ROLE_TABLE[role])
    const userId = `${role}_${openid}`
    // 双条件约束：主键 userId（含角色前缀）+ openid
    const res = await users.where({ userId, _openid: openid }).limit(1).get()
    const u = res.data[0] || null
    if (!u) {
      return { code: 0, message: 'success', data: { profile: null } }
    }
    const profile = {
      nickname: u.nickname || '',
      gender: u.gender || '',
      phone: u.phone || '',
      wechat: u.wechat || '',
      area: u.area || '',
      role: u.role || role,
    }
    return { code: 0, message: 'success', data: { profile } }
  } catch (err) {
    console.error('[getProfile] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
