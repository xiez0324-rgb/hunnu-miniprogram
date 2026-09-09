const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
      if (rRes.data.length > 0) {
        resume = rRes.data[0]
      }
      return { code: 0, message: 'success', data: { teacher, resume } }
    }

    // 2) 未入驻老师（teacherId = t_ 前缀的真实报名老师）：
    //    通过报名记录反查 openid，再用认证信息 + 简历（按 _openid 存取）组装展示
    const appRes = await db.collection('applications').where({ teacherId }).orderBy('createTime', 'desc').get()
    const app = appRes.data[0] || null
    if (app) {
      const openid = app._openid
      const vRes = await db.collection('verifications').where({ _openid: openid, status: '已通过' }).get()
      const rRes = await db.collection('resumes').where({ _openid: openid }).get()
      const verify = vRes.data[0] || null
      const resumeDoc = rRes.data[0] || null

      teacher = {
        id: teacherId,
        name: (verify && verify.name) || app.name || '大学生老师',
        school: (verify && verify.school) || app.school || '在读大学生',
        subject: (resumeDoc && resumeDoc.subjects && resumeDoc.subjects[0]) || app.subject || '科目待完善',
        rate: (resumeDoc && resumeDoc.rate) || app.rate || '时薪待协商',
        meta: (resumeDoc && resumeDoc.grades && resumeDoc.grades[0])
          ? resumeDoc.grades[0] + ' · 一对一'
          : (app.meta || '一对一'),
        quote: (resumeDoc && resumeDoc.intro ? resumeDoc.intro.slice(0, 40) : '') || app.quote || '',
        verified: !!verify,
      }
      if (resumeDoc) {
        resume = {
          subjects: resumeDoc.subjects || [],
          grades: resumeDoc.grades || [],
          timeSlots: resumeDoc.timeSlots || [],
          rate: resumeDoc.rate || '',
          districts: resumeDoc.districts || [],
          intro: resumeDoc.intro || '',
        }
      }
      return { code: 0, message: 'success', data: { teacher, resume } }
    }

    // 3) 查无任何记录：返回空，由前端渲染友好空态
    return { code: 0, message: 'success', data: { teacher: null, resume: null } }
  } catch (err) {
    console.error('[getTeacherDetail] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
