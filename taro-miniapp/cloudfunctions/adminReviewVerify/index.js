const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { verificationId, action, rejectReason } = body
    if (!verificationId) return { code: -1, message: '缺少认证记录 ID', data: null }
    if (action !== '通过' && action !== '驳回') {
      return { code: -1, message: 'action 仅支持 通过/驳回', data: null }
    }

    let verify = null
    try {
      const r = await db.collection('verifications').doc(verificationId).get()
      verify = r.data || null
    } catch (e) {
      return { code: -1, message: '认证记录不存在', data: null }
    }
    if (verify.status !== '待审核') {
      return { code: -1, message: '该认证已处理过，请刷新列表', data: null }
    }

    if (action === '通过') {
      await db.collection('verifications').doc(verificationId).update({
        data: {
          status: '已通过',
          reviewer: admin.username,
          reviewTime: db.serverDate(),
          rejectReason: '',
        },
      })
      // 同步该老师所有报名快照的 verified 标志 → 家长确认页老师卡即时显示「已认证」
      if (verify._openid) {
        await db.collection('applications').where({ _openid: verify._openid }).update({
          data: { verified: true },
        })
      }
    } else {
      await db.collection('verifications').doc(verificationId).update({
        data: {
          status: '已驳回',
          reviewer: admin.username,
          reviewTime: db.serverDate(),
          rejectReason: rejectReason || '资料不完整，请补充后重新提交',
        },
      })
    }

    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action: action === '通过' ? 'verify_pass' : 'verify_reject',
        detail: { verificationId, openid: verify._openid, rejectReason: rejectReason || '' },
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true, action } }
  } catch (err) {
    console.error('[adminReviewVerify] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
