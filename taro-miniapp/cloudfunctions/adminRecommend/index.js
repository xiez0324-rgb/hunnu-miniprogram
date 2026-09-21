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

    // 标记为平台推荐时，向该老师推送站内信（消息通知）
    if (flag) {
      try {
        const [appRes, dRes] = await Promise.all([
          db.collection('applications').where({ demandId, teacherId }).orderBy('createTime', 'desc').limit(1).get(),
          db.collection('demands').where({ id: demandId }).limit(1).get(),
        ])
        const app = appRes.data[0] || null
        const d = dRes.data[0] || null
        if (app && app._openid) {
          const label = [d && d.grade, d && d.subject].filter(Boolean).join(' · ')
          await db.collection('notices').add({
            data: {
              _openid: app._openid,
              role: 'teacher',
              type: 'recommend',
              title: '已被平台推荐',
              content: `您报名的「${label || '家教需求'}」已被平台推荐给家长，请留意后续确认通知。`,
              demandId,
              teacherId,
              read: false,
              createTime: db.serverDate(),
            },
          })
        }
      } catch (e) {
        console.warn('[adminRecommend] 写入站内信失败', e)
      }
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
