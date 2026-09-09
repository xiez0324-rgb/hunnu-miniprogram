const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 老师端「费用状态」：只读本人是否存在未结清信息费的订单。
// 安全约定：普通用户接口【绝不返回 totalFee/fee8 等金额字段】，金额仅管理员端（adminXxx）可见；
// 费用金额/费率由平台线下阶梯方案决定，不在程序中内置，也不向普通用户展示。
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const col = db.collection('fee_records')

    const res = await col.where({ teacherOpenid: openid }).orderBy('createTime', 'desc').limit(100).get()
    const records = res.data || []

    // join 需求单做展示标题（按 id / _id 双通道）
    const demandIds = [...new Set(records.map((r) => r.demandId).filter(Boolean))]
    const demandMap = {}
    if (demandIds.length) {
      const dr = await db.collection('demands').where({ id: _.in(demandIds) }).limit(100).get()
      dr.data.forEach((d) => { demandMap[d.id || d._id] = d })
      const hit = new Set(dr.data.map((d) => d.id || d._id))
      for (const mid of demandIds.filter((x) => !hit.has(x))) {
        try {
          const docRes = await db.collection('demands').doc(mid).get()
          if (docRes.data) demandMap[mid] = docRes.data
        } catch (e) { /* 忽略 */ }
      }
    }

    // 仅返回订单摘要 + 结清状态，金额字段不落出
    const list = records.map((r) => {
      const d = demandMap[r.demandId] || {}
      const demand = d.grade ? `${d.grade} · ${d.subject}${d.title ? `（${d.title}）` : ''}` : `需求单 #${r.demandId}`
      return {
        id: r._id,
        orderId: r.orderId || '',
        demand,
        status: r.status === '已付' ? '已付' : '待付', // 待付 = 存在未结清信息费
      }
    })

    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[getFeeRecords] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
