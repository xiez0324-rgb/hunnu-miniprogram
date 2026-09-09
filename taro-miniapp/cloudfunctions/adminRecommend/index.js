const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 兼容两种调用形态
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { demandId, teacherId, recommended } = body
    if (!demandId || !teacherId) return { code: -1, message: '缺少 demandId 或 teacherId', data: null }
    const flag = recommended === true || recommended === 'true'

    // 平台推荐/取消推荐：仅作用于该需求的活跃报名（家长端推荐组置顶）
    const upd = await db.collection('applications').where({
      demandId,
      teacherId,
      status: '已报名',
    }).update({ data: { recommended: flag } })

    // 若该老师已被确认（已确认态下也可标记推荐展示）
    if (!upd.stats || upd.stats.updated === 0) {
      await db.collection('applications').where({
        demandId,
        teacherId,
        status: '已推荐',
      }).update({ data: { recommended: flag } })
    }

    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action: flag ? 'recommend' : 'unrecommend',
        detail: { demandId, teacherId },
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true, recommended: flag } }
  } catch (err) {
    console.error('[adminRecommend] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
