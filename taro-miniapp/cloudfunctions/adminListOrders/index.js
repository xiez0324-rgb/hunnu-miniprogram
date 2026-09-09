const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const status = (body.status) || '全部'
    const cond = status && status !== '全部' ? { status } : {}

    const res = await db.collection('matches').where(cond).orderBy('createTime', 'desc').limit(100).get()
    let matches = res.data
    // 支持按订单 _id 精确查单（详情页使用）
    if (body.orderId) {
      try {
        const doc = await db.collection('matches').doc(String(body.orderId)).get()
        matches = doc.data ? [doc.data] : []
      } catch (e) {
        matches = []
      }
    }

    const demandIds = [...new Set(matches.map((m) => m.demandId).filter(Boolean))]
    const teacherIds = [...new Set(matches.map((m) => m.teacherId).filter(Boolean))]
    const parentOpenids = [...new Set(matches.map((m) => m.parentOpenid).filter(Boolean))]

    // 并行 join：需求单 / 家长 / 老师报名快照 三路同时发起（减少串行 RTT）
    const [dRes, uRes, aRes] = await Promise.all([
      demandIds.length
        ? db.collection('demands').where({ id: _.in(demandIds) }).limit(100).get()
        : Promise.resolve({ data: [] }),
      parentOpenids.length
        ? db.collection('parent_users').where({ _openid: _.in(parentOpenids) }).limit(100).get()
        : Promise.resolve({ data: [] }),
      teacherIds.length
        ? db.collection('applications').where({ teacherId: _.in(teacherIds) }).limit(500).get()
        : Promise.resolve({ data: [] }),
    ])

    const demandMap = {}
    dRes.data.forEach((d) => { demandMap[d.id || d._id] = d })
    // 兼容早期无业务 id 字段的需求单：未命中项并行按 _id 补查（避免 for 循环串行 doc.get）
    const hit = new Set(dRes.data.map((d) => d.id || d._id))
    const missing = demandIds.filter((x) => !hit.has(x))
    if (missing.length) {
      const settled = await Promise.allSettled(missing.map((mid) => db.collection('demands').doc(mid).get()))
      settled.forEach((s, i) => {
        if (s.status === 'fulfilled' && s.value && s.value.data) demandMap[missing[i]] = s.value.data
      })
    }

    const userMap = {}
    uRes.data.forEach((u) => { userMap[u._openid] = u })

    const appMap = {}
    aRes.data.forEach((a) => {
      const key = `${a.demandId}::${a.teacherId}`
      if (!appMap[key]) appMap[key] = a
    })

    const list = matches.map((m) => {
      const d = demandMap[m.demandId] || {}
      const u = userMap[m.parentOpenid] || {}
      const app = appMap[`${m.demandId}::${m.teacherId}`] || {}
      return {
        id: m._id,
        demandId: m.demandId,
        teacherId: m.teacherId,
        status: m.status,
        confirmedAt: m.confirmedAt || m.createTime || null,
        createTime: m.createTime || null,
        cancelTime: m.cancelTime || null,
        demand: {
          id: d.id || m.demandId,
          grade: d.grade || '',
          subject: d.subject || '',
          category: d.category || '',
          title: d.title || '',
          budget: d.budget || '',
          area: d.area || '',
          gender: d.gender || '',
        },
        teacher: {
          name: app.name || '',
          school: app.school || '',
          college: app.college || '',
          major: app.major || '',
          subject: app.subject || '',
          rate: app.rate || '',
          verified: !!app.verified,
        },
        parent: {
          nickname: u.nickname || '',
          phone: u.phone || '',
          area: u.area || '',
        },
      }
    })

    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[adminListOrders] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
