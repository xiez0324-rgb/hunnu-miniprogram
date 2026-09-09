const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 回退需求单报名人数。优先按业务 id；兼容早期无 id 字段、以 _id 访问的单
async function decreaseDemandApplicants(demandId) {
  const upd = await db.collection('demands').where({ id: demandId }).update({
    data: { applicants: _.inc(-1) },
  })
  if (!upd.stats || upd.stats.updated === 0) {
    try {
      await db.collection('demands').doc(demandId).update({
        data: { applicants: _.inc(-1) },
      })
    } catch (e) {
      // demandId 非合法文档 id（无此单或已被删），忽略
    }
  }
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { applicationId } = event

    // 读取原记录：校验归属，并判断取消前是否「占用报名名额」（已报名/已推荐）
    let cur = null
    try {
      const app = await db.collection('applications').doc(applicationId).get()
      cur = app.data || null
    } catch (e) {
      return { code: -1, message: '报名记录不存在或已删除', data: null }
    }
    if (cur._openid !== openid) {
      return { code: -1, message: '无权操作该报名记录', data: null }
    }
    const wasActive = cur.status === '已报名' || cur.status === '已推荐'

    // 取消报名不限次数，但数据全量留存（记录取消时间，供管理员检测异常操作）
    await db.collection('applications').doc(applicationId).update({
      data: { status: '已取消', cancelTime: db.serverDate() },
    })

    // 报名人数回退：仅在取消的是活跃报名时执行，保证老师端首页「已有 N 位老师报名」= 当前活跃数；
    // 重复取消（幂等）因 wasActive=false 不会二次回退
    if (wasActive) {
      await decreaseDemandApplicants(cur.demandId)
    }

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[cancelApplication] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
