const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')

// 需求单内容审核（先审后发）：新增/修改的需求默认「待审核」，
// 管理员在后台通过后才在需求广场展示，驳回则不再对外可见。
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { demandId, action, rejectReason } = body
    if (!demandId) return { code: -1, message: '缺少需求单 ID', data: null }
    if (action !== '通过' && action !== '驳回') {
      return { code: -1, message: 'action 仅支持 通过/驳回', data: null }
    }

    // 业务 id 优先，兼容按 _id 访问的旧单
    let demand = null
    const r = await db.collection('demands').where({ id: demandId }).limit(1).get()
    demand = r.data[0] || null
    let docId = demand ? demand._id : ''
    if (!demand) {
      try {
        const dr = await db.collection('demands').doc(demandId).get()
        demand = dr.data || null
        docId = demand ? demand._id : ''
      } catch (e) {
        demand = null
      }
    }
    if (!demand) return { code: -1, message: '需求单不存在', data: null }

    const auditStatus = action === '通过' ? '已通过' : '已驳回'
    if (demand.auditStatus === auditStatus) {
      return { code: 0, message: 'success', data: { changed: false, auditStatus } }
    }

    await db.collection('demands').doc(docId).update({
      data: {
        auditStatus,
        reviewer: admin.username,
        reviewTime: db.serverDate(),
        rejectReason: action === '驳回' ? rejectReason || '内容不符合平台发布规范' : '',
      },
    })

    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action: action === '通过' ? 'demand_pass' : 'demand_reject',
        detail: { demandId, docId, rejectReason: rejectReason || '' },
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { changed: true, auditStatus } }
  } catch (err) {
    console.error('[adminReviewDemand] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
