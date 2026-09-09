const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

// 管理员需求单列表：支持按状态筛选；join 家长与活跃报名数
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const status = (body.status) || '全部'
    const cond = status && status !== '全部' ? { status } : {}

    const res = await db.collection('demands').where(cond).orderBy('createTime', 'desc').limit(200).get()
    const demands = res.data || []

    const parentOpenids = [...new Set(demands.map((d) => d.parentOpenid).filter(Boolean))]
    const demandIds = demands.map((d) => d.id || d._id)

    const [userRes, appRes] = await Promise.all([
      parentOpenids.length
        ? db.collection('parent_users').where({ _openid: _.in(parentOpenids) }).limit(100).get()
        : Promise.resolve({ data: [] }),
      demandIds.length
        ? db.collection('applications')
            .where({ demandId: _.in(demandIds), status: _.in(['已报名', '已推荐']) })
            .limit(500)
            .get()
        : Promise.resolve({ data: [] }),
    ])

    const userMap = {}
    userRes.data.forEach((u) => { userMap[u._openid] = u })
    const appCount = {}
    appRes.data.forEach((a) => {
      const k = a.demandId || ''
      if (!k) return
      appCount[k] = (appCount[k] || 0) + 1
    })

    const list = demands.map((d) => {
      const u = userMap[d.parentOpenid] || {}
      return {
        id: d.id || d._id,
        docId: d._id,
        status: d.status || '进行中',
        grade: d.grade || '',
        subject: d.subject || '',
        category: d.category || '',
        title: d.title || '',
        budget: d.budget || '',
        area: d.area || '',
        gender: d.gender || '',
        classTime: d.classTime || '',
        desc: d.desc || d.note || '',
        createTime: d.createTime || null,
        applicants: appCount[d.id || d._id] || 0,
        parent: { nickname: u.nickname || '', phone: u.phone || '' },
      }
    })

    return { code: 0, message: 'success', data: { list, total: list.length } }
  } catch (err) {
    console.error('[adminListDemands] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
