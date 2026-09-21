const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { checkTexts, SCENE } = require('./contentCheck')

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
  // 性别：老师端为必填（家长端简历「基础信息」展示，两端需对齐）；家长端选填（仅用于默认称呼）
  if (!gender && role === 'teacher') return '请选择性别'
  if (gender && gender !== '男' && gender !== '女') return '性别参数不正确'
  // 联系电话必填：平台需通过电话与用户对接（家长对接试课 / 老师对接接单）；仅登录/进入时不会索取
  if (!phone) return '联系电话为必填项'
  if (!/^1\d{10}$/.test(phone)) return '手机号格式不正确'
  if (wechat.length > 50) return '微信号过长（不超过 50 字符）'
  if (role === 'teacher' && !area) return '老师所在区域为必填项'
  if (area.length > 50) return '所在区域过长（不超过 50 字符）'
  return null
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

    // role 必须显式来自调用方（本地 store 是身份切换的事实来源）：
    // 决定写入哪张表，避免家长/老师档案互相覆盖
    const effRole = body.role === 'parent' || body.role === 'teacher' ? body.role : 'teacher'
    const table = ROLE_TABLE[effRole]
    const users = db.collection(table)
    const userId = `${effRole}_${openid}`
    let res
    try {
      res = await users.where({ userId, _openid: openid }).limit(1).get()
    } catch (e) {
      // 集合不存在（新环境/误删）：自动建表后按「档案不存在」引导先登录，避免直接抛数据库错误
      if (!isCollectionMissing(e)) throw e
      try {
        await db.createCollection(table)
      } catch (err) {
        /* 已存在或并发创建：忽略 */
      }
      res = { data: [] }
    }
    const u = res.data[0] || null
    if (!u) {
      return { code: -1, message: '用户档案不存在，请先登录', data: null }
    }

    const errMsg = validate(body, effRole)
    if (errMsg) {
      return { code: -1, message: errMsg, data: null }
    }

    // 内容安全检测：称呼/微信号/所在区域属资料类文本，先做违规内容过滤
    const riskMsg = await checkTexts([body.nickname, body.wechat, body.area], openid, SCENE.资料)
    if (riskMsg) {
      return { code: -1, message: riskMsg, data: null }
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
