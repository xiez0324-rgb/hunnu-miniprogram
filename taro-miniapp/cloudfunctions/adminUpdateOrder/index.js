const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

const ALLOWED_STATUS = ['待联系', '已联系', '已成交', '已取消']

// 更新需求单状态（业务 id 优先，兼容按 _id 的旧单）
async function updateDemandStatus(demandId, patch) {
  const r = await db.collection('demands').where({ id: demandId }).update({ data: patch })
  if (!r.stats || r.stats.updated === 0) {
    try {
      await db.collection('demands').doc(demandId).update({ data: patch })
    } catch (e) {
      // 忽略：非合法文档 id
    }
  }
}

async function writeAudit(admin, action, detail) {
  await db.collection('audit_logs').add({
    data: {
      operator: admin.username,
      level: admin.level || 'admin',
      action,
      detail,
      createTime: db.serverDate(),
    },
  })
}

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { orderId, status } = body
    if (!orderId) return { code: -1, message: '缺少订单 ID', data: null }
    if (!ALLOWED_STATUS.includes(status)) {
      return { code: -1, message: `非法状态（允许：${ALLOWED_STATUS.join('/')}）`, data: null }
    }

    let match = null
    try {
      const r = await db.collection('matches').doc(orderId).get()
      match = r.data || null
    } catch (e) {
      return { code: -1, message: '订单不存在', data: null }
    }

    const from = match.status
    if (from === status) {
      return { code: 0, message: 'success', data: { changed: false, from, to: status } }
    }

    // 1) 更新订单状态（可逆：允许任意方向切换）
    await db.collection('matches').doc(orderId).update({
      data: {
        status,
        updateTime: db.serverDate(),
        cancelTime: status === '已取消' ? db.serverDate() : null,
      },
    })

    const appCol = db.collection('applications')
    const whereKey = { demandId: match.demandId, teacherId: match.teacherId }

    // 2) 业务侧联动（尽力可逆，保证端上状态一致）
    if (status === '已成交') {
      // 成交：老师报名记录置已成交 + 需求单收单
      await appCol.where({ ...whereKey, status: '已确认' }).update({ data: { status: '已成交', dealTime: db.serverDate() } })
      await updateDemandStatus(match.demandId, { status: '已成交' })
    } else if (from === '已成交') {
      // 从成交回退：该单老师回「已确认」，需求恢复进行中
      await appCol.where({ ...whereKey, status: '已成交' }).update({ data: { status: '已确认' } })
      await updateDemandStatus(match.demandId, { status: '进行中' })
    } else if (status === '已取消') {
      // 取消订单：释放该老师回备选池
      await appCol.where({ ...whereKey, status: '已确认' }).update({ data: { status: '已推荐' } })
    } else if (from === '已取消' && status !== '已取消') {
      // 取消后恢复：老师重新占用为「已确认」
      await appCol.where({ ...whereKey, status: '已推荐' }).update({ data: { status: '已确认' } })
    }

    await writeAudit(admin, 'update_order', { orderId, demandId: match.demandId, teacherId: match.teacherId, from, to: status })

    return { code: 0, message: 'success', data: { changed: true, from, to: status } }
  } catch (err) {
    console.error('[adminUpdateOrder] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
