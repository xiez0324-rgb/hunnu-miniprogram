const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 系统通知「授权绑定 + 触发推送」统一入口
// ------------------------------------------------------------
// 1) get/set：记录用户为事件主动授权订阅后的绑定意向；
//    绑定随身份分表存储（parent_users/teacher_users 对应家长/老师），
//    主键 userId = `${role}_${openid}`，只读写当前身份所在表，互不污染。
// 2) sendTest：向本人发一条测试订阅消息，用于联调全链路。
// ------------------------------------------------------------

const ROLE_TABLE = {
  parent: 'parent_users',
  teacher: 'teacher_users',
}

const TEMPLATES = {
  parent_demand_published: { templateId: '', page: 'pages/progress/index' },
  parent_new_applicant: { templateId: '', page: 'pages/progress/index' },
  parent_recommended: { templateId: '', page: 'pages/progress/index' },
  teacher_new_demand: { templateId: '', page: 'pages/home/index' },
  teacher_recommended: { templateId: '', page: 'pages/progress/index' },
  teacher_confirmed: { templateId: '', page: 'pages/progress/index' },
}

const ALLOWED_KEYS = Object.keys(TEMPLATES)

function buildData(eventKey) {
  const common = {
    thing1: { value: '小小陪伴帮' },
    thing2: { value: '请打开小程序查看详情' },
    time3: { value: '刚刚' },
  }
  switch (eventKey) {
    case 'parent_demand_published':
      return { thing1: { value: '您的需求已发布成功' }, thing2: { value: '请留意老师报名' }, time3: common.time3 }
    case 'parent_new_applicant':
      return { thing1: { value: '您的需求有新老师报名' }, thing2: { value: '代理人正在核验' }, time3: common.time3 }
    case 'parent_recommended':
      return { thing1: { value: '已为您推荐合适人选' }, thing2: { value: '请进入我的需求确认' }, time3: common.time3 }
    case 'teacher_new_demand':
      return { thing1: { value: '有符合条件的新需求' }, thing2: { value: '快去广场看看吧' }, time3: common.time3 }
    case 'teacher_recommended':
      return { thing1: { value: '您的报名已被推荐' }, thing2: { value: '请留意代理人联系' }, time3: common.time3 }
    case 'teacher_confirmed':
      return { thing1: { value: '家长已确认您授课' }, thing2: { value: '代理人将尽快联系您' }, time3: common.time3 }
    default:
      return common
  }
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const action = body.action || 'get'
    // 家长/老师绑定随身份分表
    const role = body.role === 'parent' ? 'parent' : 'teacher'
    const users = db.collection(ROLE_TABLE[role])
    const userId = `${role}_${openid}`

    const getPrefs = async () => {
      const res = await users.where({ userId, _openid: openid }).limit(1).get()
      const u = res.data[0]
      return Array.isArray(u && u.notifyPrefs) ? u.notifyPrefs : []
    }

    if (action === 'get') {
      return { code: 0, message: 'success', data: { events: await getPrefs() } }
    }

    if (action === 'set') {
      const events = Array.isArray(body.events) ? body.events.filter((k) => ALLOWED_KEYS.includes(k)) : []
      const res = await users.where({ userId, _openid: openid }).limit(1).get()
      if (res.data.length > 0) {
        await users.doc(res.data[0]._id).update({
          data: { notifyPrefs: events, notifyPrefTime: db.serverDate() },
        })
      } else {
        await users.add({
          data: {
            _openid: openid,
            userId,
            role,
            notifyPrefs: events,
            notifyPrefTime: db.serverDate(),
            createTime: db.serverDate(),
          },
        })
      }
      return { code: 0, message: 'success', data: { ok: true, events } }
    }

    if (action === 'sendTest') {
      const eventKey = body.eventKey
      const conf = TEMPLATES[eventKey]
      if (!conf || !conf.templateId) {
        return {
          code: 0,
          message: 'success',
          data: { ok: false, reason: '模板未配置：请先在公众平台订阅消息中申请并填入 notifyPref/TEMPLATES' },
        }
      }
      const prefs = await getPrefs()
      if (!prefs.includes(eventKey)) {
        return {
          code: 0,
          message: 'success',
          data: { ok: false, reason: '尚未在该事件上完成授权，请先开启订阅后再发送测试' },
        }
      }
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: openid,
          templateId: conf.templateId,
          page: conf.page,
          lang: 'zh_CN',
          miniprogramState: 'developer',
          data: buildData(eventKey),
        })
        return { code: 0, message: 'success', data: { ok: true, reason: '已发送，请查看微信服务通知' } }
      } catch (err) {
        console.error('[notifyPref] sendTest 失败', err)
        return {
          code: 0,
          message: 'success',
          data: { ok: false, reason: `发送失败：${(err && err.errMsg) || err.message || '微信侧拒绝'}` },
        }
      }
    }

    return { code: -1, message: '未知 action', data: null }
  } catch (err) {
    console.error('[notifyPref] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
