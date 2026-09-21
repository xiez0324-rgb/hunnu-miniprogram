const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 同一账号可能存在多条「已通过」认证记录（重新认证后历史记录被置空并标记 superseded）。
// 家长端必须始终读取「已颁发编号的正式档案」，否则会展示历史占位姓名（如「同学」），
// 导致老师端实名信息与家长端展示不一致。
function pickCanonicalVerify(records) {
  const list = (records || []).slice().sort((a, b) => {
    const ta = Date.parse((a && a.reviewTime) || 0) || 0
    const tb = Date.parse((b && b.reviewTime) || 0) || 0
    return tb - ta
  })
  if (!list.length) return null
  return list.find((v) => v.teacherNo) || list.find((v) => !v.superseded) || list[0]
}

// 家长端简历展示字段的唯一组装入口：
// 无论老师来自「teachers 种子表」还是「真实报名老师（t_ 前缀）」，都经这里统一输出，
// 避免两条路径字段不一致（历史上 t_ 路径漏了 rateByStage，导致家长端看不到分学段时薪）。
function assembleResume(doc) {
  if (!doc) return null
  const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])
  const rateByStage =
    doc.rateByStage && typeof doc.rateByStage === 'object' && Object.keys(doc.rateByStage).length
      ? doc.rateByStage
      : undefined
  return {
    subjects: list(doc.subjects),
    grades: list(doc.grades),
    timeSlots: list(doc.timeSlots),
    rate: String(doc.rate || '').trim(),
    // 分档时薪：家长端优先展示
    ...(rateByStage ? { rateByStage } : {}),
    districts: list(doc.districts),
    intro: String(doc.intro || '').trim(),
    // 教学经历（与老师端简历页一致）
    teachingYears: String(doc.teachingYears || '').trim(),
    experience: String(doc.experience || '').trim(),
    certificates: list(doc.certificates),
  }
}

exports.main = async (event, context) => {
  try {
    const { teacherId } = event
    let teacher = null
    let resume = null

    // 1) 平台已入驻老师（teachers 种子表，如 t1-t6），简历按 teacherId 挂载
    const tRes = await db.collection('teachers').where({ id: teacherId }).get()
    if (tRes.data.length > 0) {
      teacher = tRes.data[0]
      const rRes = await db.collection('resumes').where({ teacherId }).get()
      resume = assembleResume(rRes.data[0] || null)
      return { code: 0, message: 'success', data: { teacher, resume } }
    }

    // 2) 未入驻老师（teacherId = t_ 前缀的真实报名老师）：
    //    通过报名记录反查 openid，再用认证信息 + 简历（按 _openid 存取）组装展示
    const appRes = await db.collection('applications').where({ teacherId }).orderBy('createTime', 'desc').get()
    const app = appRes.data[0] || null
    if (app) {
      const openid = app._openid
      const [vRes, rRes, uRes] = await Promise.all([
        db.collection('verifications').where({ _openid: openid, status: '已通过' }).limit(10).get(),
        db.collection('resumes').where({ _openid: openid }).get(),
        db.collection('teacher_users').where({ _openid: openid }).limit(1).get().catch(() => ({ data: [] })),
      ])
      const verify = pickCanonicalVerify(vRes.data)
      const resumeDoc = rRes.data[0] || null
      const userDoc = uRes.data[0] || null

      teacher = {
        id: teacherId,
        name: (verify && verify.name) || app.name || '大学生老师',
        school: (verify && verify.school) || app.school || '在读大学生',
        college: (verify && verify.college) || app.college || '',
        major: (verify && verify.major) || app.major || '',
        // 简历基础信息：性别（家长端可见，来源与老师端「个人信息」同一份档案）
        gender: (userDoc && userDoc.gender) || app.gender || '',
        subject: (resumeDoc && resumeDoc.subjects && resumeDoc.subjects[0]) || app.subject || '科目待完善',
        rate: (resumeDoc && resumeDoc.rate) || app.rate || '时薪待协商',
        meta: (resumeDoc && resumeDoc.grades && resumeDoc.grades[0])
          ? resumeDoc.grades[0] + ' · 一对一'
          : (app.meta || '一对一'),
        quote: (resumeDoc && resumeDoc.intro ? resumeDoc.intro.slice(0, 40) : '') || app.quote || '',
        verified: !!verify,
        // 认证通过后颁发的唯一 5 位专属编号（家长端简历可见）
        teacherNo: (verify && verify.teacherNo) || (userDoc && userDoc.teacherNo) || app.teacherNo || '',
      }
      resume = assembleResume(resumeDoc)
      return { code: 0, message: 'success', data: { teacher, resume } }
    }

    // 3) 查无任何记录：返回空，由前端渲染友好空态
    return { code: 0, message: 'success', data: { teacher: null, resume: null } }
  } catch (err) {
    console.error('[getTeacherDetail] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
