const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { demandId } = event
    // 该需求的所有「活跃」报名老师（家长端确认人选页：推荐置顶，其余靠后）。
    // 只返回 已报名/已推荐/已确认，排除已取消的历史记录，避免出现重复/已退出的老师
    const res = await db.collection('applications')
      .where({ demandId, status: _.in(['已报名', '已推荐', '已确认']) })
      .orderBy('createTime', 'asc')
      .get()
    // 报名记录里 teacherId 是老师业务 id，映射为前端 Teacher 所需的 id 字段
    const list = res.data.map((a) => Object.assign({}, a, { id: a.teacherId }))
    return {
      code: 0,
      message: 'success',
      data: {
        recommended: list.filter((a) => a.recommended),
        others: list.filter((a) => !a.recommended),
      },
    }
  } catch (err) {
    console.error('[getApplicants] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
