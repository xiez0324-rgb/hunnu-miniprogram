const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')
const {
  GENERIC_AUTH_ERROR,
  evaluateLock,
  buildFailurePatch,
  successResetPatch,
} = require('./loginGuard')

// 与 adminInit / adminChangePassword 使用同一盐值算法。
// 盐值从云函数环境变量读取，禁止写死（配置说明见 adminInit/index.js 顶部注释）。
const SALT = process.env.ADMIN_PASSWORD_SALT
function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw) + SALT).digest('hex')
}

exports.main = async (event, context) => {
  try {
    if (!SALT) {
      console.error('[adminLogin] 缺少 ADMIN_PASSWORD_SALT 环境变量')
      return { code: -1, message: '服务端未配置 ADMIN_PASSWORD_SALT，暂时无法登录，请联系维护者', data: null }
    }

    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { username, password } = body
    if (!username || !password) {
      return { code: -1, message: '请输入账号与密码', data: null }
    }

    const res = await db.collection('admins').where({ username: String(username).trim() }).limit(1).get()
    const admin = res.data[0] || null

    // 账号不存在 / 已停用 / 密码错误 一律返回同一句文案，避免攻击者枚举有效账号
    if (!admin || !admin.enabled) {
      return { code: -1, message: GENERIC_AUTH_ERROR, data: null }
    }

    // 锁定期内即使密码正确也拒绝（抵御字典攻击）
    const now = Date.now()
    const lock = evaluateLock(admin, now)
    if (lock.locked) {
      return { code: -1, message: `账号已临时锁定，请约 ${lock.minutesLeft} 分钟后再试`, data: null }
    }

    if (admin.passwordHash !== hashPassword(password)) {
      const { patch, message } = buildFailurePatch(admin, now)
      await db.collection('admins').doc(admin._id).update({ data: patch })
      return { code: -1, message, data: null }
    }

    // 生成会话 token（单会话简化：同一管理员重新登录会替换旧 token）
    const token = crypto.randomBytes(24).toString('hex')
    await db.collection('admins').doc(admin._id).update({
      data: { currentToken: token, lastLoginAt: db.serverDate(), ...successResetPatch() },
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
