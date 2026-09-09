const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { demandId, teacherId } = event

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
