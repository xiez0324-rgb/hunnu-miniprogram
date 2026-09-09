const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { demandId, teacherId } = event
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

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
