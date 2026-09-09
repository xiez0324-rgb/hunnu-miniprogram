const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { demandId } = event
    let res = await db.collection('demands').where({ id: demandId }).get()
    let demand = res.data[0] || null

    // 兜底：早期/1号版本发布的需求可能只有文档 _id、没有业务 id 字段，按 _id 再查一次
    if (!demand) {
      try {
        const docRes = await db.collection('demands').doc(demandId).get()
        demand = docRes.data || null
      } catch (e) {
        // doc 不存在（demandId 非合法 _id 或记录已被删），视为未找到
        demand = null
      }
    }

    // 回填 id 字段，保证前端 Demand 结构与报名关联（applyDemand 传 demand.id）可用
    if (demand && !demand.id) {
      demand.id = demand._id
    }

    return { code: 0, message: 'success', data: { demand } }
  } catch (err) {
    console.error('[getDemandDetail] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
