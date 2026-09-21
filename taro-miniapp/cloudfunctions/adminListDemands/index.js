const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')
const { safeGet } = require('./safeQuery')

// 管理员需求单列表：支持按状态筛选；join 家长与活跃报名数
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const status = (body.status) || '全部'
    const auditStatus = (body.auditStatus) || '全部'
    const cond = {}
    if (status && status !== '全部') cond.status = status
    if (auditStatus && auditStatus !== '全部') cond.auditStatus = auditStatus

    const res = await db.collection('demands').where(cond).orderBy('createTime', 'desc').limit(200).get()
    const demands = res.data || []

    // 兼容历史数据：早期需求单未写 parentOpenid，用发布者 _openid 兜底关联家长档案
    const parentOpenids = [...new Set(demands.map((d) => d.parentOpenid || d._openid).filter(Boolean))]
    const demandIds = demands.map((d) => d.id || d._id)

    const [userRes, appRes] = await Promise.all([
      parentOpenids.length
        ? safeGet(
            db,
            'parent_users',
            () => db.collection('parent_users').where({ _openid: _.in(parentOpenids) }).limit(100).get(),
            'adminListDemands',
          )
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
      const u = userMap[d.parentOpenid || d._openid] || {}
      // 联系电话优先级：家长账号档案 → 需求单发布时填写的联系手机（历史/未建档数据兜底），
      // 保证管理员在任何情况下都能拿到一个可用号码联系家长
      const phone = u.phone || d.phone || ''
      return {
        id: d.id || d._id,
        docId: d._id,
        status: d.status || '进行中',
        auditStatus: d.auditStatus || '待审核',
        grade: d.grade || '',
        subject: d.subject || '',
        category: d.category || '',
        title: d.title || '',
        budget: d.budget || '',
        area: d.area || '',
        gender: d.gender || '',
        // 需求单服务时段字段为 time，classTime 为兼容旧数据
        classTime: d.classTime || d.time || '',
        desc: d.desc || d.note || '',
        createTime: d.createTime || null,
        applicants: appCount[d.id || d._id] || 0,
        parent: {
          nickname: u.nickname || '',
          phone,
          wechat: u.wechat || '',
          area: u.area || '',
          // 家长档案是否存在：便于管理员判断信息完整度（电话仍可用需求单兜底）
          hasProfile: !!u._openid,
          // 电话是否来自需求单兜底（家长档案未填手机号）
          fromDemand: !u.phone && !!d.phone,
        },
      }
    })

    return { code: 0, message: 'success', data: { list, total: list.length } }
  } catch (err) {
    console.error('[adminListDemands] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
