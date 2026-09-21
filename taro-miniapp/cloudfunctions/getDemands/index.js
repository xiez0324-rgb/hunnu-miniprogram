const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { filter = '全部', page = 0, pageSize = 20 } = event
    const demands = db.collection('demands')
    let where = {}
    if (filter === '体育' || filter === '艺术' || filter === '编程') {
      where.category = filter
    } else if (filter !== '全部') {
      where.subject = filter
    }
    where.status = '进行中'
    // 先审后发：仅展示管理员审核通过的需求（历史无 auditStatus 的旧数据暂不展示）
    where.auditStatus = '已通过'
    // 对外招募口径：管理员标记「已联系」后 recruiting=false，需求立即从广场下架，不再接受报名。
    // 老数据无该字段，_.neq(false) 对「字段不存在」同样成立，不影响历史需求展示。
    where.recruiting = _.neq(false)

    const res = await demands
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()

    // 兼容无业务 id 字段的旧数据：回填 _id，保证列表点击跳详情可用。
    // 数据隔离口径：平台内「已审核通过的需求」属于脱敏后的撮合信息，任何登录用户可浏览；
    // 家长联系方式（phone）与归属 openid 属于私密数据，一律不下发（需私密数据请看
    // getMyData / getApplicants —— 那两个接口按 openid 严格校验归属）。
    // 注意：此处不要依赖 teacher_users 等身份记录做过滤，否则该集合缺失/未建档时
    // 会把老师端广场整个收窄成空列表（表现为「审核通过了但学生端看不到单」）。
    const list = res.data.map((d) => {
      const safe = { ...d, id: d.id || d._id }
      delete safe.phone
      delete safe._openid
      return safe
    })

    return { code: 0, message: 'success', data: { demands: list } }
  } catch (err) {
    console.error('[getDemands] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
