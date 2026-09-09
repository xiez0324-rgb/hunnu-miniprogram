const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  try {
    const res = await db.collection('teachers').get()
    return { code: 0, message: 'success', data: { teachers: res.data } }
  } catch (err) {
    console.error('[getTeachers] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
