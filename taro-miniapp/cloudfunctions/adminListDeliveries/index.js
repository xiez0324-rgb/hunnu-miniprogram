const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 兼容两种调用形态
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const status = (body.status) || '全部'

    // 投递去向 = 家长「想进一步了解某老师」（inquiries）构成的咨询/试课备选队列
    const cond = status && status !== '全部' ? { status } : {}
    const res = await db.collection('inquiries').where(cond).orderBy('createTime', 'desc').limit(100).get()
    const inquiries = res.data

    const demandIds = [...new Set(inquiries.map((q) => q.demandId).filter(Boolean))]
    const parentOpenids = [...new Set(inquiries.map((q) => q.parentOpenid).filter(Boolean))]
    const teacherIds = [...new Set(inquiries.map((q) => q.teacherId).filter(Boolean))]

    // 并行 join：需求单 / 家长 / 报名快照 / 订单状态 四路同时发起
    const [dRes, uRes, aRes, oRes] = await Promise.all([
      demandIds.length
        ? db.collection('demands').where({ id: _.in(demandIds) }).limit(100).get()
        : Promise.resolve({ data: [] }),
      parentOpenids.length
        ? db.collection('parent_users').where({ _openid: _.in(parentOpenids) }).limit(100).get()
        : Promise.resolve({ data: [] }),
      teacherIds.length
        ? db.collection('applications').where({ teacherId: _.in(teacherIds) }).limit(500).get()
        : Promise.resolve({ data: [] }),
      demandIds.length && teacherIds.length
        ? db.collection('matches').where({
            demandId: _.in(demandIds),
            teacherId: _.in(teacherIds),
          }).limit(100).get()
        : Promise.resolve({ data: [] }),
    ])

    const demandMap = {}
    dRes.data.forEach((d) => { demandMap[d.id || d._id] = d })
    // 兼容早期无业务 id 字段的需求单：未命中项并行按 _id 补查
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

    // join 老师快照（报名记录）与风控提示（该老师历史取消次数）
    const appMap = {}
    const cancelStat = {}
    aRes.data.forEach((a) => {
      const key = `${a.demandId}::${a.teacherId}`
      if (!appMap[key]) appMap[key] = a
      if (a.status === '已取消') cancelStat[a.teacherId] = (cancelStat[a.teacherId] || 0) + 1
    })

    // 订单状态（该组合是否有待联系/已联系/已成交单）
    const orderMap = {}
    oRes.data.forEach((m) => {
      orderMap[`${m.demandId}::${m.teacherId}`] = m.status
    })

    const list = inquiries.map((q) => {
      const d = demandMap[q.demandId] || {}
      const u = userMap[q.parentOpenid] || {}
      const app = appMap[`${q.demandId}::${q.teacherId}`] || {}
      const cancelCount = cancelStat[q.teacherId] || 0
      const riskNote =
        cancelCount >= 3
          ? `该老师近期取消 ${cancelCount} 次，建议人工核验后再推荐`
          : cancelCount > 0
            ? `该老师有 ${cancelCount} 次历史取消记录`
            : ''
      return {
        id: q._id,
        type: q.type || '了解老师',
        status: q.status,
        demandId: q.demandId,
        teacherId: q.teacherId,
        createTime: q.createTime || null,
        orderStatus: orderMap[`${q.demandId}::${q.teacherId}`] || null,
        recommended: !!app.recommended,
        demand: {
          id: d.id || q.demandId,
          grade: d.grade || '',
          subject: d.subject || '',
          category: d.category || '',
          title: d.title || '',
          area: d.area || '',
          budget: d.budget || '',
          gender: d.gender || '',
          classTime: d.classTime || '',
          note: d.desc || d.note || '',
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
        parent: { nickname: u.nickname || '', phone: u.phone || '' },
        riskNote,
      }
    })

    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[adminListDeliveries] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
