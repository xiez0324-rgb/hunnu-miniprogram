const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

// 管理员报名列表：老师报名记录（含需求摘要、老师快照、openid）
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const status = (body.status) || '全部'
    const cond = status && status !== '全部' ? { status } : {}

    const res = await db.collection('applications').where(cond).orderBy('createTime', 'desc').limit(200).get()
    const apps = res.data || []

    const demandIds = [...new Set(apps.map((a) => a.demandId).filter(Boolean))]

    const demandMap = {}
    if (demandIds.length) {
      const r = await db.collection('demands').where({ id: _.in(demandIds) }).limit(100).get()
      r.data.forEach((d) => { demandMap[d.id || d._id] = d })
      const hit = new Set(r.data.map((d) => d.id || d._id))
      const missing = demandIds.filter((x) => !hit.has(x))
      if (missing.length) {
        const settled = await Promise.allSettled(missing.map((mid) => db.collection('demands').doc(mid).get()))
        settled.forEach((s, i) => {
          if (s.status === 'fulfilled' && s.value && s.value.data) demandMap[missing[i]] = s.value.data
        })
      }
    }

    const list = apps.map((a) => {
      const d = demandMap[a.demandId] || {}
      return {
        id: a._id,
        teacherId: a.teacherId || '',
        openid: a.openid || a._openid || '',
        demandId: a.demandId || '',
        status: a.status || '',
        verified: !!a.verified,
        rate: a.rate || '',
        rateByStage: a.rateByStage || null,
        createTime: a.createTime || null,
        teacher: {
          name: a.name || '',
          school: a.school || '',
          college: a.college || '',
          major: a.major || '',
          subject: a.subject || '',
        },
        demand: {
          grade: d.grade || '',
          subject: d.subject || '',
          title: d.title || '',
          area: d.area || '',
          budget: d.budget || '',
        },
      }
    })

    return { code: 0, message: 'success', data: { list, total: list.length } }
  } catch (err) {
    console.error('[adminListApplications] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
