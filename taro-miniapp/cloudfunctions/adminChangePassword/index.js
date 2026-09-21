const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')
const { requireAdmin } = require('./requireAdmin')

// 与 adminLogin / adminInit 使用同一盐值算法。
// 盐值从云函数环境变量读取，禁止写死（配置说明见 adminInit/index.js 顶部注释）。
const SALT = process.env.ADMIN_PASSWORD_SALT
function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw) + SALT).digest('hex')
}

// 管理员修改自己的登录密码（以有效 token 鉴权后即可设置新密码）。
// 改密成功后旧 token 立即失效，需用新密码重新登录。
exports.main = async (event, context) => {
  try {
    if (!SALT) {
      console.error('[adminChangePassword] 缺少 ADMIN_PASSWORD_SALT 环境变量')
      return { code: -1, message: '服务端未配置 ADMIN_PASSWORD_SALT，暂时无法改密，请联系维护者', data: null }
    }

    const admin = await requireAdmin(event) // 鉴权：必须是已登录管理员本人

    // 兼容两种调用形态
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { newPassword, oldPassword } = body

    if (!newPassword || String(newPassword).length < 6) {
      return { code: -1, message: '新密码至少 6 位', data: null }
    }
    // 双保险：如传入旧密码则校验
    if (oldPassword && admin.passwordHash !== hashPassword(oldPassword)) {
      return { code: -1, message: '旧密码不正确', data: null }
    }

    await db.collection('admins').doc(admin._id).update({
      data: {
        passwordHash: hashPassword(newPassword),
        currentToken: '', // 作废旧会话，强制重新登录
        updateTime: db.serverDate(),
      },
    })

    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action: 'change_password',
        detail: { username: admin.username },
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[adminChangePassword] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
