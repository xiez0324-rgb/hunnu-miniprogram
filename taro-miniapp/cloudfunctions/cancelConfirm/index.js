const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { demandId, teacherId } = event
    const openid = cloud.getWXContext().OPENID
    if (!demandId || !teacherId) {
      return { code: -1, message: '参数不完整', data: null }
    }

    // 归属校验（数据隔离）：仅需求发布者本人可取消已确认人选，
    // 否则任何人拿到 demandId 即可撤销别的家长的确认、扰乱他人订单。
    const demandRes = await db.collection('demands').where({ id: demandId }).limit(1).get()
    let demand = demandRes.data[0] || null
    if (!demand) {
      try {
        const docRes = await db.collection('demands').doc(demandId).get()
        demand = docRes.data || null
      } catch (e) {
        demand = null
      }
    }
    if (!demand) return { code: -1, message: '需求不存在或已下架', data: null }
    if (demand._openid !== openid) return { code: -1, message: '无权操作该需求', data: null }

    // 家长取消已确认人选：回退报名状态为「已推荐」，撤销该条待联系匹配
    await db.collection('applications').where({ demandId, teacherId, status: '已确认' }).update({
      data: { status: '已推荐', confirmTime: null },
    })

    await db.collection('matches').where({ demandId, teacherId, status: '待联系' }).update({
      data: { status: '已取消', cancelTime: db.serverDate() },
    })

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[cancelConfirm] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
