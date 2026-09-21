const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { role, status = '全部' } = event

    if (role === 'parent') {
      // 家长：我的需求（仅本人 + 排除被管理员撤回下架的需求）
      const res = await db.collection('demands')
        .where({ _openid: openid, status: _.neq('已下架') })
        .orderBy('createTime', 'desc')
        .get()
      // 兼容无业务 id 字段的旧数据：回填 _id，保证列表点击跳详情可用
      const list = res.data.map((d) => (d.id ? d : { ...d, id: d._id }))

      // 已确认人选（持久化状态）：applications 中状态为「已确认」的记录，按需求单聚合
      const demandIds = [...new Set(list.map((d) => d.id).filter(Boolean))]
      const confirmMap = {}
      if (demandIds.length) {
        const appRes = await db.collection('applications')
          .where({ demandId: _.in(demandIds), status: '已确认' })
          .limit(200)
          .get()
          .catch(() => ({ data: [] }))
        appRes.data.forEach((a) => {
          if (!confirmMap[a.demandId]) {
            confirmMap[a.demandId] = {
              teacherId: a.teacherId || '',
              name: a.name || '',
              openid: a._openid || '',
              time: a.confirmTime || null,
            }
          }
        })

        // 已确认老师姓名实时化：报名记录里的 name 是快照，实名信息若被管理员合规修正，
        // 家长端「我的需求」也必须同步展示最新实名，避免与老师端/简历页不一致
        const confirmOpenids = [...new Set(Object.values(confirmMap).map((c) => c.openid).filter(Boolean))]
        if (confirmOpenids.length) {
          const vRes = await db.collection('verifications')
            .where({ _openid: _.in(confirmOpenids), status: '已通过' })
            .limit(200)
            .get()
            .catch(() => ({ data: [] }))
          // 每个账号取「已颁发编号的正式档案」
          const verifyByOpenid = {}
          ;(vRes.data || []).forEach((v) => {
            const cur = verifyByOpenid[v._openid]
            if (!cur || (!cur.teacherNo && v.teacherNo)) verifyByOpenid[v._openid] = v
          })
          Object.keys(confirmMap).forEach((k) => {
            const c = confirmMap[k]
            const v = verifyByOpenid[c.openid]
            if (v && v.name && v.name !== '同学') c.name = v.name
          })
        }
      }
      const withConfirm = list.map((d) => {
        const c = confirmMap[d.id]
        return c
          ? { ...d, confirmedTeacherId: c.teacherId, confirmedTeacherName: c.name, confirmedTime: c.time }
          : d
      })
      return { code: 0, message: 'success', data: { list: withConfirm } }
    }

    // 老师：我的报名。status 过滤由前端传参决定（'全部' 表示不筛）
    const cond = { _openid: openid }
    if (status !== '全部') {
      cond.status = status
    }
    const appRes = await db.collection('applications').where(cond).orderBy('createTime', 'desc').get()
    const rows = appRes.data

    // 关联需求单（applications 里只有老师快照，缺年级/预算/时段等需求信息）
    const demandIds = [...new Set(rows.map((r) => r.demandId).filter(Boolean))]
    const demandMap = {}
    if (demandIds.length > 0) {
      const dRes = await db.collection('demands').where({ id: _.in(demandIds) }).limit(1000).get()
      dRes.data.forEach((d) => {
        demandMap[d.id] = d
      })
    }

    // 映射成前端 Application 结构：title=年级·科目 / budget / meta=时段·区域
    const list = rows.map((r) => {
      const d = demandMap[r.demandId]
      if (!d) {
        return {
          id: r._id,
          demandId: r.demandId,
          title: '需求单 #' + r.demandId,
          budget: '',
          meta: '',
          status: r.status,
          createTime: r.createTime,
        }
      }
      return {
        id: r._id,
        demandId: r.demandId,
        title: `${d.grade} · ${d.subject}`,
        budget: d.budget || '',
        meta: [d.time, d.area].filter(Boolean).join(' · '),
        status: r.status,
        createTime: r.createTime,
      }
    })

    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[getMyData] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
