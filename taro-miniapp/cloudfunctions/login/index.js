const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ============================================================
// 分表方案：家长/老师档案物理隔离
//   parent_users ：role=parent（家长）
//   teacher_users：role=teacher（家教老师/学生端）
// 主键约定：userId = `${role}_${openid}`（角色前缀，两表永不冲突）
// 同一微信号可同时开通家长 + 老师两个身份，各自独立档案互不覆盖。
// ============================================================
const ROLE_TABLE = {
  parent: 'parent_users',
  teacher: 'teacher_users',
}

// 各角色默认昵称（仅当从未自定义时兜底）
const DEFAULT_NAME = { teacher: '张同学', parent: '' }

function tableOf(role) {
  return ROLE_TABLE[role] || ROLE_TABLE.teacher
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    // 兼容 { name, data } 包装
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const role = body.role === 'parent' ? 'parent' : 'teacher'
    const { nickname = undefined, phone = '' } = body

    const users = db.collection(tableOf(role))
    const userId = `${role}_${openid}`
    // 双条件约束：主键 userId（含角色前缀）+ openid，杜绝跨表/跨身份命中
    const found = await users.where({ userId, _openid: openid }).limit(1).get()
    let user
    if (found.data.length > 0) {
      user = found.data[0]
      const existed = user.nickname || ''
      const existedPhone = user.phone || ''
      // 仅当从未自定义（空 / 演示默认名「张同学」）时重设默认昵称；已自定义保持不变
      const isDefaultish = existed === '' || existed === '张同学'
      const nextNickname = isDefaultish ? DEFAULT_NAME[role] ?? '' : existed
      await users.doc(user._id).update({
        data: {
          role,
          nickname: nextNickname,
          phone: phone || existedPhone,
          updateTime: db.serverDate(),
        },
      })
      user.role = role
      user.nickname = nextNickname
      user.phone = phone || existedPhone
    } else {
      const seedName = typeof nickname === 'string' && nickname !== '' ? nickname : DEFAULT_NAME[role] || ''
      const res = await users.add({
        data: {
          _openid: openid,
          userId,
          role,
          nickname: seedName,
          phone,
          gender: '',
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        },
      })
      user = {
        _id: res._id,
        openid,
        userId,
        role,
        nickname: seedName,
        phone,
        avatar: '',
        gender: '',
      }
    }

    return {
      code: 0,
      message: 'success',
      data: {
        openid,
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
