const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

// 管理员费用台账：查看/检索 fee_records（含金额）。仅管理员可访问。
// 金额仅供管理端使用；普通用户端 getFeeRecords 不返回任何金额字段。
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 兼容两种调用形态
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const status = (body.status) || '全部'
    const cond = status && status !== '全部' ? { status } : {}

    const res = await db.collection('fee_records').where(cond).orderBy('createTime', 'desc').limit(200).get()
    const records = res.data || []

    // 并行 join 需求标题 + 老师名
    const demandIds = [...new Set(records.map((r) => r.demandId).filter(Boolean))]
    const teacherIds = [...new Set(records.map((r) => r.teacherId).filter(Boolean))]
    const [dRes, aRes] = await Promise.all([
      demandIds.length
        ? db.collection('demands').where({ id: _.in(demandIds) }).limit(100).get()
        : Promise.resolve({ data: [] }),
      teacherIds.length
        ? db.collection('applications').where({ teacherId: _.in(teacherIds) }).limit(500).get()
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

    const teacherName = {}
    aRes.data.forEach((a) => {
      if (a.teacherId && a.name && !teacherName[a.teacherId]) teacherName[a.teacherId] = a.name
    })

    const list = records.map((r) => {
      const d = demandMap[r.demandId] || {}
      return {
        id: r._id,
        orderId: r.orderId || '',
        status: r.status,
        totalFee: r.totalFee || 0,
        fee: r.fee8 || 0,
        calcMode: r.calcMode || '',
        note: r.note || '',
        registeredBy: r.registeredBy || '',
        demandId: r.demandId,
        teacherId: r.teacherId,
        demand: d.grade ? `${d.grade} · ${d.subject}` : `需求单 #${r.demandId}`,
        teacherName: teacherName[r.teacherId] || '',
        createTime: r.createTime || null,
        updateTime: r.updateTime || null,
      }
    })

    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[adminListFeeRecords] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
