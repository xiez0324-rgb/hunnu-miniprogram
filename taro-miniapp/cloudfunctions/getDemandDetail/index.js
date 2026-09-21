const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { demandId } = event
    const openid = cloud.getWXContext().OPENID
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

    // 已撤回（整单下架）的需求对所有普通用户不可见，包含发布者本人
    if (demand && (demand.withdrawn === true || demand.status === '已下架')) {
      demand = null
    }

    // 非发布者视角额外屏蔽：
    //  ① 已成交（订单已闭环，不再对外展示详情）
    //  ② 已停止招募（管理员已标记「已联系」，recruiting=false）
    //  ③ 审核未通过（待审核 / 已驳回），仅发布者可见
    if (demand && demand._openid !== openid) {
      const closed = demand.status === '已成交' || demand.recruiting === false
      // 先审后发：无 auditStatus 的历史/种子数据同样视为「未审核通过」，不对非发布者展示
      const notApproved = demand.auditStatus !== '已通过'
      if (closed || notApproved) {
        demand = null
      }
    }

    // 数据隔离口径：已审核通过的需求详情属于脱敏后的撮合信息，任何登录用户可查看；
    // 但家长联系电话仅对发布者本人返回，其他用户一律清空（不依赖 teacher_users 等身份记录，
    // 否则该集合缺失/未建档时会误判成「无权查看」，导致老师打不开需求详情）。
    if (demand && demand._openid !== openid) {
      demand = { ...demand, phone: '' }
      delete demand._openid
    }

    return { code: 0, message: 'success', data: { demand } }
  } catch (err) {
    console.error('[getDemandDetail] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
