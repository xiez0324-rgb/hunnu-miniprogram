const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

// 需求单号检索：优先业务 id（demandId），兼容直接用文档 _id 查询
async function findDemand(keyword) {
  const r = await db
    .collection('demands')
    .where({ id: keyword })
    .limit(1)
    .get()
    .catch(() => ({ data: [] }))
  if (r.data[0]) return r.data[0]
  try {
    const doc = await db.collection('demands').doc(keyword).get()
    return doc.data || null
  } catch (e) {
    return null
  }
}

// 老师联系方式 / 专属编号映射（仅管理员可见）
async function buildContactMap(openids) {
  const map = {}
  const ids = [...new Set((openids || []).filter(Boolean))]
  if (!ids.length) return map
  const [tuRes, tvRes] = await Promise.all([
    db.collection('teacher_users').where({ _openid: _.in(ids) }).limit(200).get().catch(() => ({ data: [] })),
    db.collection('verifications').where({ _openid: _.in(ids) }).limit(200).get().catch(() => ({ data: [] })),
  ])
  tuRes.data.forEach((u) => {
    map[u._openid] = { phone: u.phone || '', teacherNo: u.teacherNo || '', gender: u.gender || '' }
  })
  tvRes.data.forEach((v) => {
    if (v.status !== '已通过' || !v.teacherNo) return
    const cur = map[v._openid] || {}
    map[v._openid] = { phone: cur.phone || '', teacherNo: cur.teacherNo || v.teacherNo, gender: cur.gender || '' }
  })
  return map
}

function feeLabel(list) {
  if (!list || !list.length) return '未登记'
  const paid = list.find((f) => f.status === '已付')
  if (paid) return '已付'
  const pending = list.find((f) => f.status === '待付')
  if (pending) return '待付'
  return list[0].status || '未登记'
}

// ============ 按需求单号检索 ============
async function queryByDemand(keyword) {
  const demand = await findDemand(keyword)
  if (!demand) {
    return { type: 'demand', keyword, demand: null, applicants: [], orders: [], feeRecords: [] }
  }
  const demandId = demand.id || demand._id

  const [appsRes, matchRes, feeRes, parentRes] = await Promise.all([
    db.collection('applications').where({ demandId }).limit(200).get().catch(() => ({ data: [] })),
    db.collection('matches').where({ demandId }).limit(100).get().catch(() => ({ data: [] })),
    db.collection('fee_records').where({ demandId }).limit(100).get().catch(() => ({ data: [] })),
    demand._openid
      ? db.collection('parent_users').where({ _openid: demand._openid }).limit(1).get().catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] }),
  ])

  const apps = appsRes.data || []
  const contactMap = await buildContactMap(apps.map((a) => a.openid || a._openid))

  const orderMap = {}
  const orders = (matchRes.data || []).map((m) => {
    orderMap[m.teacherId] = { status: m.status, id: m._id }
    return {
      id: m._id,
      demandId: m.demandId,
      teacherId: m.teacherId,
      status: m.status,
      createTime: m.createTime || null,
      confirmedAt: m.confirmedAt || null,
      cancelTime: m.cancelTime || null,
    }
  })

  const feeByTeacher = {}
  const feeRecords = (feeRes.data || []).map((f) => {
    if (f.teacherId) {
      if (!feeByTeacher[f.teacherId]) feeByTeacher[f.teacherId] = []
      feeByTeacher[f.teacherId].push(f)
    }
    return {
      id: f._id,
      orderId: f.orderId || '',
      demandId: f.demandId || '',
      teacherId: f.teacherId || '',
      status: f.status || '',
      totalFee: f.totalFee || 0,
      fee: f.fee != null ? f.fee : f.fee8 || 0,
      createTime: f.createTime || null,
    }
  })

  const parent = parentRes.data[0] || {}
  const applicants = apps.map((a) => {
    const oid = a.openid || a._openid
    const c = contactMap[oid] || {}
    const order = orderMap[a.teacherId] || {}
    const fees = feeByTeacher[a.teacherId] || []
    return {
      id: a._id,
      teacherId: a.teacherId || '',
      openid: oid || '',
      name: a.name || '',
      phone: c.phone || '',
      teacherNo: c.teacherNo || '',
      school: a.school || '',
      college: a.college || '',
      major: a.major || '',
      subject: a.subject || '',
      rate: a.rate || '',
      verified: !!a.verified,
      status: a.status || '',
      createTime: a.createTime || null,
      orderStatus: order.status || null,
      orderId: order.id || null,
      feeStatus: feeLabel(fees),
      feeAmount: fees.reduce((s, f) => s + (Number(f.fee) || 0), 0),
    }
  })

  return {
    type: 'demand',
    keyword,
    demand: {
      id: demandId,
      grade: demand.grade || '',
      subject: demand.subject || '',
      category: demand.category || '',
      title: demand.title || '',
      budget: demand.budget || '',
      area: demand.area || '',
      gender: demand.gender || '',
      classTime: demand.time || demand.classTime || '',
      note: demand.note || demand.desc || '',
      status: demand.status || '',
      auditStatus: demand.auditStatus || '',
      createTime: demand.createTime || null,
      orderStatus: orders.length ? orders.map((o) => o.status).join(' / ') : null,
      feeStatus: feeLabel(feeRecords),
      parent: {
        nickname: parent.nickname || '',
        phone: parent.phone || demand.phone || '',
        area: parent.area || '',
        wechat: parent.wechat || '',
      },
    },
    applicants,
    orders,
    feeRecords,
  }
}

// ============ 按老师专属编号 / teacherId 检索 ============
async function queryByTeacher(keyword) {
  // 1) 编号命中的老师账号（认证通过记录 + 账号档案双通道）
  let openid = ''
  const [vRes, uRes] = await Promise.all([
    db.collection('verifications').where({ teacherNo: keyword }).limit(1).get().catch(() => ({ data: [] })),
    db.collection('teacher_users').where({ teacherNo: keyword }).limit(1).get().catch(() => ({ data: [] })),
  ])
  if (uRes.data[0]) openid = uRes.data[0]._openid || ''
  if (!openid && vRes.data[0]) openid = vRes.data[0]._openid || ''

  // 2) 兼容用 teacherId 检索（t_xxx / t1 等）
  let appsRes = { data: [] }
  if (openid) {
    appsRes = await db.collection('applications').where({ _openid: openid }).limit(200).get().catch(() => ({ data: [] }))
  } else {
    appsRes = await db.collection('applications').where({ teacherId: keyword }).limit(200).get().catch(() => ({ data: [] }))
    const first = appsRes.data[0]
    if (first) openid = first.openid || first._openid || ''
  }

  if (!openid && !appsRes.data.length) {
    return { type: 'teacher', keyword, teacher: null, demands: [], orders: [], feeRecords: [] }
  }

  const contactMap = await buildContactMap([openid])
  const contact = contactMap[openid] || {}

  const [userRes, veriRes, resumeRes] = await Promise.all([
    openid ? db.collection('teacher_users').where({ _openid: openid }).limit(1).get().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    openid ? db.collection('verifications').where({ _openid: openid, status: '已通过' }).limit(10).get().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    openid ? db.collection('resumes').where({ _openid: openid }).limit(1).get().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
  ])
  const userDoc = userRes.data[0] || {}
  // 多条已通过记录时取「已颁发编号的正式档案」，避免管理员看到历史占位姓名/空编号
  const veriList = (veriRes.data || []).slice().sort((a, b) => {
    const ta = Date.parse((a && a.reviewTime) || 0) || 0
    const tb = Date.parse((b && b.reviewTime) || 0) || 0
    return tb - ta
  })
  const verify = veriList.find((v) => v.teacherNo) || veriList.find((v) => !v.superseded) || veriList[0] || {}
  const resume = resumeRes.data[0] || {}

  const teacherId = (appsRes.data[0] && appsRes.data[0].teacherId) || keyword
  const apps = appsRes.data || []
  const demandIds = [...new Set(apps.map((a) => a.demandId).filter(Boolean))]

  const demandMap = {}
  if (demandIds.length) {
    const dRes = await db.collection('demands').where({ id: _.in(demandIds) }).limit(200).get().catch(() => ({ data: [] }))
    dRes.data.forEach((d) => {
      demandMap[d.id || d._id] = d
    })
  }

  // 家长联系方式（仅管理员可见）：需求单所属家长（parentOpenid 优先，历史数据用 _openid 兜底），
  // 家长档案缺失手机号时回退需求单发布时填写的联系电话，保证管理员随时能联系到家长
  const qParentOpenids = [...new Set(
    Object.values(demandMap).map((d) => d.parentOpenid || d._openid).filter(Boolean),
  )]
  const qParentMap = {}
  if (qParentOpenids.length) {
    const pRes = await db.collection('parent_users')
      .where({ _openid: _.in(qParentOpenids) })
      .limit(200)
      .get()
      .catch(() => ({ data: [] }))
    pRes.data.forEach((u) => { qParentMap[u._openid] = u })
  }

  const [matchRes, feeRes] = await Promise.all([
    teacherId ? db.collection('matches').where({ teacherId }).limit(100).get().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    teacherId ? db.collection('fee_records').where({ teacherId }).limit(100).get().catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
  ])

  const orderStatusByDemand = {}
  const orders = (matchRes.data || []).map((m) => {
    orderStatusByDemand[m.demandId] = m.status
    return {
      id: m._id,
      demandId: m.demandId,
      teacherId: m.teacherId,
      status: m.status,
      createTime: m.createTime || null,
      confirmedAt: m.confirmedAt || null,
      cancelTime: m.cancelTime || null,
    }
  })

  const feeByDemand = {}
  const feeRecords = (feeRes.data || []).map((f) => {
    if (f.demandId) {
      if (!feeByDemand[f.demandId]) feeByDemand[f.demandId] = []
      feeByDemand[f.demandId].push(f)
    }
    return {
      id: f._id,
      orderId: f.orderId || '',
      demandId: f.demandId || '',
      teacherId: f.teacherId || '',
      status: f.status || '',
      totalFee: f.totalFee || 0,
      fee: f.fee != null ? f.fee : f.fee8 || 0,
      createTime: f.createTime || null,
    }
  })

  const demands = apps.map((a) => {
    const d = demandMap[a.demandId] || {}
    const p = qParentMap[d.parentOpenid || d._openid] || {}
    return {
      id: d.id || a.demandId,
      grade: d.grade || '',
      subject: d.subject || '',
      category: d.category || '',
      title: d.title || '',
      budget: d.budget || '',
      area: d.area || '',
      gender: d.gender || '',
      classTime: d.time || d.classTime || '',
      note: d.note || d.desc || '',
      status: d.status || '',
      auditStatus: d.auditStatus || '',
      createTime: d.createTime || null,
      orderStatus: orderStatusByDemand[a.demandId] || null,
      feeStatus: feeLabel(feeByDemand[a.demandId] || []),
      // 该老师在该需求下的报名状态，前端用于展示
      applyStatus: a.status || '',
      // 家长联系方式：按老师检索时同样可直接联系家长
      parent: {
        nickname: p.nickname || '',
        phone: p.phone || d.phone || '',
        wechat: p.wechat || '',
        area: p.area || '',
      },
    }
  })

  return {
    type: 'teacher',
    keyword,
    teacher: {
      id: teacherId,
      openid,
      name: (verify && verify.name) || (userDoc.realName && userDoc.realName.name) || '',
      gender: userDoc.gender || '',
      phone: userDoc.phone || contact.phone || '',
      teacherNo: userDoc.teacherNo || (verify && verify.teacherNo) || contact.teacherNo || '',
      school: (verify && verify.school) || (userDoc.realName && userDoc.realName.school) || '',
      college: (verify && verify.college) || (userDoc.realName && userDoc.realName.college) || '',
      major: (verify && verify.major) || (userDoc.realName && userDoc.realName.major) || '',
      verified: !!(verify && verify._id),
      realNameLocked: !!userDoc.realNameLocked,
      subjects: resume.subjects || [],
      grades: resume.grades || [],
      rate: resume.rate || '',
      intro: resume.intro || '',
    },
    demands,
    orders,
    feeRecords,
  }
}

exports.main = async (event, context) => {
  try {
    await requireAdmin(event) // 鉴权：仅管理员可查看隐私联系方式
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const type = body.type === 'teacher' ? 'teacher' : 'demand'
    const keyword = String(body.keyword || '').trim()
    if (!keyword) return { code: -1, message: '请输入检索关键词', data: null }

    const data = type === 'teacher' ? await queryByTeacher(keyword) : await queryByDemand(keyword)
    return { code: 0, message: 'success', data }
  } catch (err) {
    console.error('[adminQueryOrder] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
