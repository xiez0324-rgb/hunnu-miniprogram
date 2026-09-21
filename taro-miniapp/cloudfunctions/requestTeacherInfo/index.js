const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { demandId, teacherId } = event
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // 归属校验（数据隔离）：仅需求发布者本人可发起「了解该老师」咨询，
    // 避免他人凭 demandId 往平台咨询队列写入无关记录、污染后台待办。
    if (!demandId || !teacherId) {
      return { code: -1, message: '参数不完整', data: null }
    }
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

    // 家长「想进一步了解该老师」：写入咨询队列，管理员后台收到消息并处理
    await db.collection('inquiries').add({
      data: {
        demandId,
        teacherId,
        parentOpenid: openid,
        type: '了解老师',
        status: '待处理',
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[requestTeacherInfo] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
