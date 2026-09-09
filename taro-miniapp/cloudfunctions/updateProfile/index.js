const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 家长/老师档案分表更新
const ROLE_TABLE = {
  parent: 'parent_users',
  teacher: 'teacher_users',
}

// 服务端白名单校验（与前端一致，双保险）
function validate(data, role) {
  const nickname = String(data.nickname || '').trim()
  const phone = String(data.phone || '').trim()
  const wechat = String(data.wechat || '').trim()
  const area = String(data.area || '').trim()
  const gender = String(data.gender || '').trim()

  if (!nickname || nickname.length > 20) return '姓名必填且不超过 20 字'
  if (gender && gender !== '男' && gender !== '女') return '性别参数不正确'
  // 联系电话为选填：仅校验格式；未填允许保存（微信审核要求不得强制索取手机号，代理人可后续通过微信补充确认）
  if (phone && !/^1\d{10}$/.test(phone)) return '手机号格式不正确'
  if (wechat.length > 50) return '微信号过长（不超过 50 字符）'
  if (role === 'teacher' && !area) return '老师所在区域为必填项'
  if (area.length > 50) return '所在区域过长（不超过 50 字符）'
  return null
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    // 兼容 { name, data } 包装
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}

    // role 必须显式来自调用方（本地 store 是身份切换的事实来源）：
    // 决定写入哪张表，避免家长/老师档案互相覆盖
    const effRole = body.role === 'parent' || body.role === 'teacher' ? body.role : 'teacher'
    const users = db.collection(ROLE_TABLE[effRole])
    const userId = `${effRole}_${openid}`
    const res = await users.where({ userId, _openid: openid }).limit(1).get()
    const u = res.data[0] || null
    if (!u) {
      return { code: -1, message: '用户档案不存在，请先登录', data: null }
    }

    const errMsg = validate(body, effRole)
    if (errMsg) {
      return { code: -1, message: errMsg, data: null }
    }

    // 双条件精确定位（主键 userId + openid）后按 _id 更新，仅改目标用户
    await users.doc(u._id).update({
      data: {
        nickname: String(body.nickname || '').trim(),
        gender: String(body.gender || '').trim(),
        phone: String(body.phone || '').trim(),
        wechat: String(body.wechat || '').trim(),
        area: String(body.area || '').trim(),
        updateTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true, userId, role: effRole } }
  } catch (err) {
    console.error('[updateProfile] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
