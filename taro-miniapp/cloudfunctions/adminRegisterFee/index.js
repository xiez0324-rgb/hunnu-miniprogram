const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')

function round2(n) {
  return Math.round(n * 100) / 100
}

// 管理员登记/调整信息费（幂等 upsert by orderId）。
// 定价策略完全由管理员决定，代码不内置任何固定费率：
//  - 传 feeAmount：直接使用管理员给出的信息费金额（自定义定价）
//  - 传 ratePercent + totalFee：按管理员填写的费率百分比计算（round2）
//  - 两者都不传：仅登记订单为「待付」，金额留空，后续管理员可再次调用本函数补充/调整
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权：仅管理员可访问/修改费用

    // 兼容两种调用形态
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { orderId, status, note } = body
    if (!orderId) return { code: -1, message: '缺少订单 ID', data: null }
    if (status && status !== '待付' && status !== '已付') {
      return { code: -1, message: 'status 仅支持 待付/已付', data: null }
    }

    const totalFee = body.totalFee === undefined || body.totalFee === '' ? 0 : Number(body.totalFee)
    const feeAmount = body.feeAmount === undefined || body.feeAmount === '' ? null : Number(body.feeAmount)
    const ratePercent = body.ratePercent === undefined || body.ratePercent === '' ? 0 : Number(body.ratePercent)

    if (totalFee < 0 || (feeAmount !== null && feeAmount < 0) || ratePercent < 0) {
      return { code: -1, message: '金额/费率不能为负数', data: null }
    }

    // 信息费 = 显式自定义金额优先；否则按管理员填写的费率计算；否则置 0（待后续补充）
    let fee8 = 0
    let calcMode = 'empty'
    if (feeAmount !== null) {
      fee8 = round2(feeAmount)
      calcMode = 'manual'
    } else if (ratePercent > 0 && totalFee > 0) {
      fee8 = round2((totalFee * ratePercent) / 100)
      calcMode = 'percent'
    }

    // 读取订单（matches）取业务关联字段
    let match = null
    try {
      const r = await db.collection('matches').doc(orderId).get()
      match = r.data || null
    } catch (e) {
      return { code: -1, message: '订单不存在', data: null }
    }

    const col = db.collection('fee_records')
    const exist = await col.where({ orderId }).limit(1).get()

    const payload = {
      orderId,
      demandId: match.demandId || '',
      teacherId: match.teacherId || '',
      parentOpenid: match.parentOpenid || '',
      totalFee,
      fee8,
      status: status || '待付',
      note: note || '',
      calcMode,
      registeredBy: admin.username,
      updateTime: db.serverDate(),
    }

    if (exist.data.length > 0) {
      await col.doc(exist.data[0]._id).update({ data: payload })
    } else {
      await col.add({ data: { ...payload, createTime: db.serverDate() } })
    }

    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action: 'register_fee',
        detail: { orderId, totalFee, feeAmount, ratePercent, fee8, status: status || '待付', calcMode },
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true, orderId, fee8, calcMode } }
  } catch (err) {
    console.error('[adminRegisterFee] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
