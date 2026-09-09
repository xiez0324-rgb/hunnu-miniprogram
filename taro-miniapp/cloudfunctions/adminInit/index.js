const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')

// 与 adminLogin 使用同一盐值算法
const SALT = '[盐值改为云函数环境变量 ADMIN_PASSWORD_SALT]'
function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw) + SALT).digest('hex')
}

// 初始化云函数（一次性/幂等）：
// 1. 创建 admins、audit_logs 集合（已存在则跳过）
// 2. admins 为空时灌入默认超级管理员 admin / [默认口令已在后续版本移除]
// ⚠️ 默认账号请登录后立即在生产环境停用本函数或修改默认密码。
exports.main = async (event, context) => {
  try {
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
      await db.collection('admins').add({
        data: {
          username: 'admin',
          passwordHash: hashPassword('[默认口令已在后续版本移除]'),
          uid: '',
          openid: '',
          currentToken: '',
          level: 'root',
          enabled: true,
          note: '默认账号，请尽快修改密码',
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
