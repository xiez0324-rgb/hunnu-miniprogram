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

    const res = await demands
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get()

    // 兼容无业务 id 字段的旧数据：回填 _id，保证列表点击跳详情可用
    const list = res.data.map((d) => (d.id ? d : { ...d, id: d._id }))

    return { code: 0, message: 'success', data: { demands: list } }
  } catch (err) {
    console.error('[getDemands] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
