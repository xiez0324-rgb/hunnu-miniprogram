const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { demandId, teacherId } = event
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // ===== 归属校验（数据隔离）=====
    // 仅需求发布者本人可确认人选。否则任何人拿到 demandId 即可替别的家长确认老师，
    // 且会把 matches.parentOpenid 写成调用者 openid，造成跨账号数据混淆。
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

    // 只能确认「已报名 / 已推荐 / 已确认」的活跃报名老师，避免确认一个从未报名的老师
    const appRes = await db.collection('applications')
      .where({ demandId, teacherId, status: _.in(['已报名', '已推荐', '已确认']) })
      .limit(1)
      .get()
    if (appRes.data.length === 0) {
      return { code: -1, message: '该老师未报名此需求，无法确认', data: null }
    }

    // ===== 幂等确认：同一需求只允许一条有效确认 =====
    // 1. 回退该需求下其它已确认老师的报名状态（A/B 同时确认的漏洞修复）
    await db.collection('applications').where({
      demandId,
      status: '已确认',
      teacherId: _.neq(teacherId),
    }).update({
      data: { status: '已推荐', confirmTime: null },
    })

    // 2. 撤销该需求下旧的待联系匹配记录（防止 matches 里堆积多条待处理）
    await db.collection('matches').where({
      demandId,
      status: '待联系',
      teacherId: _.neq(teacherId),
    }).update({
      data: { status: '已取消', cancelTime: db.serverDate() },
    })

    // 3. 更新当前确认老师的报名状态（只作用于活跃报名，避免把「已取消」的历史记录误置为已确认）
    await db.collection('applications').where({
      demandId,
      teacherId,
      status: _.in(['已报名', '已推荐', '已确认']),
    }).update({
      data: { status: '已确认', confirmTime: db.serverDate() },
    })

    // 4. 若该老师已有待联系匹配则复用，否则新建一条
    const existing = await db.collection('matches').where({ demandId, teacherId, status: '待联系' }).get()
    if (existing.data.length === 0) {
      await db.collection('matches').add({
        data: {
          demandId,
          teacherId,
          parentOpenid: openid,
          status: '待联系',
          confirmedAt: db.serverDate(),
          createTime: db.serverDate(),
        },
      })
    }

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[confirmMatch] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
