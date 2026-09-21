const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 家长/老师档案分表读取
const ROLE_TABLE = {
  parent: 'parent_users',
  teacher: 'teacher_users',
}

// 与前端 src/utils/nickname.ts 保持一致：未自定义称呼时的系统占位名
const PLACEHOLDER_NICKNAMES = ['同学', '张同学', '老师用户', '家长用户', '王女士']
function isPlaceholderNickname(nick) {
  const v = String(nick || '').trim()
  return !v || PLACEHOLDER_NICKNAMES.indexOf(v) >= 0
}

function isCollectionMissing(e) {
  const msg = String((e && (e.errMsg || e.message)) || '')
  return Boolean(e && e.errCode === -502005) || /collection not exists|Db or Table not exist|ResourceNotFound/i.test(msg)
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    // 兼容 { name, data } 包装
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    // role 必须显式指定：不同身份查不同表，杜绝跨表命中
    const role = body.role === 'parent' ? 'parent' : 'teacher'
    const table = ROLE_TABLE[role]
    const users = db.collection(table)
    const userId = `${role}_${openid}`
    // 双条件约束：主键 userId（含角色前缀）+ openid
    let res
    try {
      res = await users.where({ userId, _openid: openid }).limit(1).get()
    } catch (e) {
      if (!isCollectionMissing(e)) throw e
      // 集合尚未创建（新环境/误删）：视为「暂无档案」并顺手建表，避免直接抛错
      try {
        await db.createCollection(table)
      } catch (err) {
        /* 已存在或并发创建：忽略 */
      }
      res = { data: [] }
    }
    const u = res.data[0] || null
    if (!u) {
      return { code: 0, message: 'success', data: { profile: null } }
    }

    // 专属编号：优先取账号档案；缺失时回退到「最近一次已通过认证」的正式档案，
    // 避免账号档案与正式档案不一致导致「我的」页展示错误编号
    let teacherNo = u.teacherNo || ''
    let verified = !!u.verified
    let nickname = u.nickname || ''
    // 老师端「个人信息」未填写真实姓名时，家长端看到的是实名认证姓名，
    // 这里做同一份兜底展示，避免两端显示不同姓名（不写库，仅展示层对齐）
    const needVerifyFallback =
      role === 'teacher' && (!teacherNo || isPlaceholderNickname(nickname))
    if (needVerifyFallback) {
      try {
        const vRes = await db
          .collection('verifications')
          .where({ _openid: openid, status: '已通过' })
          .orderBy('reviewTime', 'desc')
          .limit(10)
          .get()
        const records = vRes.data || []
        if (records.length) verified = true
        // 编号：取最近一条已颁发编号的正式档案（历史被置空/替代的记录自动跳过）
        if (!teacherNo) {
          const withNo = records.find((v) => v.teacherNo)
          if (withNo) teacherNo = String(withNo.teacherNo)
        }
        // 姓名：确保证件姓名优先于占位名
        if (isPlaceholderNickname(nickname)) {
          const named = records.find((v) => v.name)
          if (named) nickname = String(named.name)
        }
      } catch (e) {
        /* 忽略：以账号档案为准 */
      }
    }

    const profile = {
      nickname,
      gender: u.gender || '',
      phone: u.phone || '',
      wechat: u.wechat || '',
      area: u.area || '',
      role: u.role || role,
      // 老师专属 5 位编号（认证通过后颁发，用于「我的」页昵称后展示）
      teacherNo,
      verified,
    }
    return { code: 0, message: 'success', data: { profile } }
  } catch (err) {
    console.error('[getProfile] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
