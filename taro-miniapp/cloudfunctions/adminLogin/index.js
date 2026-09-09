const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')

// 与 adminInit 种子账号使用同一盐值算法
const SALT = '[盐值改为云函数环境变量 ADMIN_PASSWORD_SALT]'
function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw) + SALT).digest('hex')
}

exports.main = async (event, context) => {
  try {
    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { username, password } = body
    if (!username || !password) {
      return { code: -1, message: '请输入账号与密码', data: null }
    }

    const res = await db.collection('admins').where({ username: String(username).trim() }).limit(1).get()
    const admin = res.data[0] || null
    if (!admin) {
      return { code: -1, message: '账号不存在', data: null }
    }
    if (!admin.enabled) {
      return { code: -1, message: '账号已停用，请联系超级管理员', data: null }
    }
    if (admin.passwordHash !== hashPassword(password)) {
      return { code: -1, message: '账号或密码错误', data: null }
    }

    // 生成会话 token（单会话简化：同一管理员重新登录会替换旧 token）
    const token = crypto.randomBytes(24).toString('hex')
    await db.collection('admins').doc(admin._id).update({
      data: { currentToken: token, lastLoginAt: db.serverDate() },
    })

    return {
      code: 0,
      message: 'success',
      data: { token, username: admin.username, level: admin.level || 'admin' },
    }
  } catch (err) {
    console.error('[adminLogin] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
