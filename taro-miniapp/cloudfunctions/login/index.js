const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ============================================================
// 分表方案：家长/老师档案物理隔离
//   parent_users ：role=parent（家长）
//   teacher_users：role=teacher（家教老师/学生端）
// 主键约定：userId = `${role}_${openid}`（角色前缀，两表永不冲突）
// 同一微信号可同时开通家长 + 老师两个身份，各自独立档案互不覆盖。
//
// 微信一键登录 / 自动建号：
//   小程序端 wx.login 换 code → 本函数取 WXContext.OPENID/UNIONID
//   → 首次登录自动在该角色表创建绑定 openid/unionid 的独立账号（幂等，可并发）
//   → 之后每次登录只做资料回读与默认昵称兜底，不会重复建号
// ============================================================
const ROLE_TABLE = {
  parent: 'parent_users',
  teacher: 'teacher_users',
}

// 各角色默认昵称（仅当从未自定义时兜底）：老师端未命名前统一称呼为「同学」
const DEFAULT_NAME = { teacher: '同学', parent: '' }

function tableOf(role) {
  return ROLE_TABLE[role] || ROLE_TABLE.teacher
}

// 集合不存在（-502005 Db or Table not exist）判定
function isCollectionMissing(e) {
  const msg = String((e && (e.errMsg || e.message)) || '')
  return Boolean(e && e.errCode === -502005) || /collection not exists|Db or Table not exist|ResourceNotFound/i.test(msg)
}

// 首次使用某角色表时自动建集合（幂等；容器复用后不再重复调用）
const ensuredTables = new Set()
async function ensureTable(name) {
  if (ensuredTables.has(name)) return
  try {
    await db.createCollection(name)
  } catch (e) {
    // 已存在（并发/历史创建）忽略；真实异常交由后续查询暴露
  }
  ensuredTables.add(name)
}

async function findUser(users, table, userId, openid) {
  try {
    const r = await users.where({ userId, _openid: openid }).limit(1).get()
    return r.data[0] || null
  } catch (e) {
    if (isCollectionMissing(e)) {
      // 集合缺失：自动创建后重试一次（首次部署 / 误删集合场景）
      await ensureTable(table)
      const r2 = await users.where({ userId, _openid: openid }).limit(1).get()
      return r2.data[0] || null
    }
    throw e
  }
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const unionid = wxContext.UNIONID || ''
    // 兼容 { name, data } 包装
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const role = body.role === 'parent' ? 'parent' : 'teacher'
    const { nickname = undefined, phone = '' } = body

    const table = tableOf(role)
    const users = db.collection(table)
    const userId = `${role}_${openid}`

    // 自动建表 + 双条件约束查询：主键 userId（含角色前缀）+ openid，杜绝跨表/跨身份命中
    const existed = await findUser(users, table, userId, openid)

    let user
    if (existed) {
      user = existed
      const prevNick = user.nickname || ''
      const existedPhone = user.phone || ''
      // 仅当从未自定义（空 / 历史演示默认名「张同学」「同学」）时重设默认昵称；已自定义保持不变
      const isDefaultish = prevNick === '' || prevNick === '张同学' || prevNick === '同学'
      const nextNickname = isDefaultish ? DEFAULT_NAME[role] ?? '' : prevNick
      await users.doc(user._id).update({
        data: {
          role,
          nickname: nextNickname,
          phone: phone || existedPhone,
          unionid: unionid || user.unionid || '',
          updateTime: db.serverDate(),
        },
      })
      user.role = role
      user.nickname = nextNickname
      user.phone = phone || existedPhone
      user.unionid = unionid || user.unionid || ''
    } else {
      const seedName = typeof nickname === 'string' && nickname !== '' ? nickname : DEFAULT_NAME[role] || ''
      const doc = {
        _openid: openid,
        userId,
        role,
        nickname: seedName,
        phone,
        gender: '',
        unionid,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      }
      try {
        const res = await users.add({ data: doc })
        user = Object.assign({ _id: res._id, openid }, doc)
      } catch (e) {
        // 并发注册：同一 openid+角色 可能被另一个请求先创建 → 回读既有账号，避免重复建号
        const again = await findUser(users, table, userId, openid)
        if (!again) throw e
        user = again
      }
    }

    return {
      code: 0,
      message: 'success',
      data: {
        openid,
        unionid: user.unionid || unionid,
        userId: user.userId || userId,
        nickname: user.nickname || '',
        avatar: user.avatar || '',
        role: user.role || role,
        phone: user.phone || phone,
        gender: user.gender || '',
      },
    }
  } catch (err) {
    console.error('[login] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
