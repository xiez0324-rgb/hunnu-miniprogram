const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { name, school, materials, authorized } = event

    await db.collection('verifications').add({
      data: {
        _openid: openid,
        name,
        school,
        materials,
        authorized,
        status: '待审核',
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[submitVerification] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
