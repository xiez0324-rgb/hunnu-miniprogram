const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')

// 口令哈希盐值从云函数环境变量读取，**禁止**写死在代码里（公开仓库会直接泄露）。
// 配置位置：云开发控制台 → 云函数 → adminInit / adminLogin / adminChangePassword
//          → 配置 → 环境变量 → ADMIN_PASSWORD_SALT
// 注意：三个函数的该变量必须保持一致，且需与数据库中已有 passwordHash 所用的盐值一致，
//      否则所有管理员都将无法登录（详见 HANDOVER.md 「环境变量与本地配置」）。
const SALT = process.env.ADMIN_PASSWORD_SALT
function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw) + SALT).digest('hex')
}

const MIN_INITIAL_PASSWORD_LENGTH = 8

// ── 运维密钥闸门 ──────────────────────────────────────────────
// 本函数不属于业务链路，原实现无需任何身份即可被调用：云环境 ID 打包在小程序客户端内、
// 并非秘密，任何人都能调用云函数，故 admins 集合一旦为空，任何人都能创建一个自己的
// root 管理员。这里用 SETUP_KEY 兜底：**未配置该环境变量时一律拒绝执行**。
const SETUP_KEY = process.env.SETUP_KEY
function checkSetupKey(event) {
  if (!SETUP_KEY) {
    return '服务端未配置 SETUP_KEY 环境变量，本函数默认拒绝执行；如确需初始化请先在云函数配置中设置'
  }
  const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
  const provided = String(body.setupKey || '')
  if (!provided) return '缺少 setupKey 参数'
  const a = Buffer.from(provided)
  const b = Buffer.from(SETUP_KEY)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'setupKey 不正确'
  return null
}

// 初始化云函数（一次性/幂等）：
// 1. 创建 admins、audit_logs 集合（已存在则跳过）
// 2. admins 为空时创建超级管理员，账号取 event.username（默认 admin），
//    口令必须由调用方通过 event.initialPassword 传入，**不再内置任何默认口令**。
// ⚠️ 初始化完成后请在控制台停用或删除本函数，避免被反复调用。
exports.main = async (event, context) => {
  try {
    const denied = checkSetupKey(event)
    if (denied) return { code: -1, message: denied, data: null }

    if (!SALT) {
      return {
        code: -1,
        message: '服务端未配置 ADMIN_PASSWORD_SALT 环境变量，请先在云函数配置中设置后再调用',
        data: null,
      }
    }

    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}

    const created = []
    const skipped = []
    for (const name of ['admins', 'audit_logs']) {
      try {
        await db.createCollection(name)
        created.push(name)
      } catch (e) {
        skipped.push(name)
      }
    }

    let seeded = false
    const countRes = await db.collection('admins').count()
    if (countRes.total === 0) {
      const username = String(body.username || 'admin').trim()
      const initialPassword = String(body.initialPassword || '')

      if (username.length < 3) {
        return { code: -1, message: '管理员账号至少 3 位', data: { created, skipped, seededDefaultAdmin: false } }
      }
      if (initialPassword.length < MIN_INITIAL_PASSWORD_LENGTH) {
        return {
          code: -1,
          message: `首次初始化必须通过 initialPassword 传入至少 ${MIN_INITIAL_PASSWORD_LENGTH} 位的新口令（本函数不再提供内置默认口令）`,
          data: { created, skipped, seededDefaultAdmin: false },
        }
      }

      await db.collection('admins').add({
        data: {
          username,
          passwordHash: hashPassword(initialPassword),
          uid: '',
          openid: '',
          currentToken: '',
          level: 'root',
          enabled: true,
          note: '初始化创建，请勿使用弱口令',
          createTime: db.serverDate(),
        },
      })
      seeded = true
    }

    return {
      code: 0,
      message: 'success',
      data: { created, skipped, seededDefaultAdmin: seeded },
    }
  } catch (err) {
    console.error('[adminInit] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
