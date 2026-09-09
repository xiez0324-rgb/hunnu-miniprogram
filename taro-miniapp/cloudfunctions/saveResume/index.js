const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { subjects, grades, timeSlots, rate, districts, intro } = event

    const resumes = db.collection('resumes')
    const found = await resumes.where({ _openid: openid }).get()
    if (found.data.length > 0) {
      await resumes.doc(found.data[0]._id).update({
        data: { subjects, grades, timeSlots, rate, districts, intro, updateTime: db.serverDate() },
      })
    } else {
      await resumes.add({
        data: { _openid: openid, subjects, grades, timeSlots, rate, districts, intro, createTime: db.serverDate() },
      })
    }

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[saveResume] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
