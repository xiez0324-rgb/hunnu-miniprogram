const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

// 管理员报名列表：老师报名记录（含需求摘要、老师快照、openid）
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const status = (body.status) || '全部'
    const cond = status && status !== '全部' ? { status } : {}

    const res = await db.collection('applications').where(cond).orderBy('createTime', 'desc').limit(200).get()
    const apps = res.data || []

    const demandIds = [...new Set(apps.map((a) => a.demandId).filter(Boolean))]

    const demandMap = {}
    if (demandIds.length) {
      const r = await db.collection('demands').where({ id: _.in(demandIds) }).limit(100).get()
      r.data.forEach((d) => { demandMap[d.id || d._id] = d })
      const hit = new Set(r.data.map((d) => d.id || d._id))
      const missing = demandIds.filter((x) => !hit.has(x))
      if (missing.length) {
        const settled = await Promise.allSettled(missing.map((mid) => db.collection('demands').doc(mid).get()))
        settled.forEach((s, i) => {
          if (s.status === 'fulfilled' && s.value && s.value.data) demandMap[missing[i]] = s.value.data
        })
      }
    }

    // 老师完整联系方式与专属编号（仅管理员可见）
    const teacherOpenids = [...new Set(apps.map((a) => a.openid || a._openid).filter(Boolean))]
    const contactMap = {}
    if (teacherOpenids.length) {
      const [tuRes, tvRes] = await Promise.all([
        db.collection('teacher_users').where({ _openid: _.in(teacherOpenids) }).limit(200).get().catch(() => ({ data: [] })),
        db.collection('verifications').where({ _openid: _.in(teacherOpenids) }).limit(200).get().catch(() => ({ data: [] })),
      ])
      tuRes.data.forEach((u) => {
        contactMap[u._openid] = { phone: u.phone || '', teacherNo: u.teacherNo || '' }
      })
      tvRes.data.forEach((v) => {
        if (v.status !== '已通过' || !v.teacherNo) return
        const cur = contactMap[v._openid] || {}
        contactMap[v._openid] = { phone: cur.phone || '', teacherNo: cur.teacherNo || v.teacherNo }
      })
    }

    // 家长联系方式（仅管理员可见）：需求单所属家长（parentOpenid 优先，历史数据用 _openid 兜底），
    // 家长档案缺失手机号时回退需求单发布时填写的联系电话
    const parentOpenids = [...new Set(
      apps.map((a) => {
        const d = demandMap[a.demandId] || {}
        return d.parentOpenid || d._openid
      }).filter(Boolean),
    )]
    const parentMap = {}
    if (parentOpenids.length) {
      const pRes = await db.collection('parent_users')
        .where({ _openid: _.in(parentOpenids) })
        .limit(200)
        .get()
        .catch(() => ({ data: [] }))
      pRes.data.forEach((u) => { parentMap[u._openid] = u })
    }

    const list = apps.map((a) => {
      const d = demandMap[a.demandId] || {}
      const p = parentMap[d.parentOpenid || d._openid] || {}
      return {
        id: a._id,
        teacherId: a.teacherId || '',
        openid: a.openid || a._openid || '',
        demandId: a.demandId || '',
        status: a.status || '',
        verified: !!a.verified,
        rate: a.rate || '',
        rateByStage: a.rateByStage || null,
        createTime: a.createTime || null,
        teacher: {
          name: a.name || '',
          school: a.school || '',
          college: a.college || '',
          major: a.major || '',
          subject: a.subject || '',
          phone: contactMap[a.openid || a._openid] ? contactMap[a.openid || a._openid].phone : '',
          teacherNo: contactMap[a.openid || a._openid] ? contactMap[a.openid || a._openid].teacherNo : '',
        },
        demand: {
          grade: d.grade || '',
          subject: d.subject || '',
          title: d.title || '',
          area: d.area || '',
          budget: d.budget || '',
        },
        parent: {
          nickname: p.nickname || '',
          phone: p.phone || d.phone || '',
          wechat: p.wechat || '',
          area: p.area || '',
        },
      }
    })

    return { code: 0, message: 'success', data: { list, total: list.length } }
  } catch (err) {
    console.error('[adminListApplications] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
