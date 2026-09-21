const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

// 管理员查看老师完整简历：teacherId → 反查 applications 拿 openid → resumes/verifications 组装
// 兼容：老师可能是种子表老师(teachers) 或真实报名老师(仅存在于 applications 快照)
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const teacherId = String(body.teacherId || '').trim()
    if (!teacherId) return { code: -1, message: '缺少 teacherId', data: null }

    const openids = []
    let snapshot = {}

    // 1) 从报名记录反查 openid 与最新快照（应用文档的归属 _openid 即老师 openid）
    try {
      const r = await db.collection('applications')
        .where({ teacherId })
        .limit(20)
        .get()
      r.data.forEach((a) => {
        const oid = a.openid || a._openid
        if (oid && !openids.includes(oid)) openids.push(oid)
        if (!snapshot.name) snapshot = { ...a, openid: oid || '' }
      })
    } catch (e) { /* 忽略 */ }

    // 2) 若 teacherId 本身就是 openid 形态，直接作为兜底
    if (!openids.length && (teacherId.length > 20)) openids.push(teacherId)

    // 3) 并行读取简历 / 认证 / 老师账号档案 / 种子老师（按 id 或 _id 双通道）
    const [resumeRes, veriRes, userRes, teacherRes] = await Promise.all([
      openids.length
        ? db.collection('resumes').where({ _openid: _.in(openids) }).limit(5).get()
        : Promise.resolve({ data: [] }),
      openids.length
        ? db.collection('verifications').where({ _openid: _.in(openids) }).limit(5).get()
        : Promise.resolve({ data: [] }),
      openids.length
        ? db.collection('teacher_users').where({ _openid: _.in(openids) }).limit(5).get().catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
      Promise.allSettled([
        db.collection('teachers').where({ id: teacherId }).limit(1).get().catch(() => ({ data: [] })),
        db.collection('teachers').doc(teacherId).get().catch(() => null),
      ]).then((settled) => {
        let seed = {}
        settled.forEach((s) => {
          const doc = s.status === 'fulfilled' && s.value && (s.value.data || s.value) ? s.value.data || s.value : null
          if (doc && doc._id) seed = doc
        })
        return Promise.resolve({ data: seed._id ? [seed] : [] })
      }),
    ])

    const resume = resumeRes.data[0] || {}
    const verification = veriRes.data[0] || {}
    const userDoc = userRes.data[0] || {}
    const seed = teacherRes.data[0] || {}

    // 4) 组装（resume / verification / snapshot 优先级递减；种子仅补默认信息）
    const base = { ...snapshot, ...verification, ...userDoc, ...resume }
    const teacher = {
      id: teacherId,
      openid: openids[0] || '',
      name: base.name || seed.name || '',
      gender: base.gender || seed.gender || '',
      avatar: base.avatar || seed.avatar || '',
      school: base.school || seed.school || '',
      college: base.college || seed.college || '',
      major: base.major || seed.major || '',
      degree: base.degree || seed.degree || '',
      verified: !!(verification.authorized || snapshot.verified || seed.verified),
      verificationStatus: verification.status || (verification._id ? '已认证' : ''),
      authorized: !!verification.authorized,
      // 管理员可见的完整联系方式与专属编号（老师/家长端接口均不下发）
      phone: userDoc.phone || '',
      teacherNo: userDoc.teacherNo || verification.teacherNo || seed.teacherNo || '',
      realNameLocked: !!(userDoc.realNameLocked || verification.archived),
      subjects: resume.subjects || [],
      grades: resume.grades || [],
      timeSlots: resume.timeSlots || [],
      districts: resume.districts || [],
      rate: resume.rate || snapshot.rate || seed.rate || '',
      rateByStage: resume.rateByStage || snapshot.rateByStage || null,
      intro: resume.intro || '',
      years: resume.years || seed.years || '',
      source: verification._id ? '认证档案' : resume._id ? '简历档案' : snapshot.name ? '报名快照' : seed._id ? '老师档案' : '基础档案',
    }

    return { code: 0, message: 'success', data: { teacher } }
  } catch (err) {
    console.error('[adminGetTeacherDetail] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
