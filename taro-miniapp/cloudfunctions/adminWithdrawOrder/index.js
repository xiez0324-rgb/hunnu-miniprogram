const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const { requireAdmin } = require('./requireAdmin')

// 可撤回的订单状态：仅「未完成」的已发布订单（已成交/已取消/已撤回不可再撤回）
const WITHDRAWABLE = ['待联系', '已联系']
// 撤回后需一并作废的活跃报名状态
const ACTIVE_APPLICATION = ['已报名', '已推荐', '已确认', '已成交']

// 订单管理权限校验：
//  - level 为 root/admin 的管理员默认具备；
//  - 也可通过 admins 文档上的 perms / permissions 数组精细授权（'order:manage' | 'orders' | 'order' | '*'）；
//  - 兼容 orderManage === true 的布尔开关。
// 非管理员（如仅客服/审核岗）调用会被拒绝，确保接口权限隔离。
function canManageOrders(admin) {
  if (!admin || admin.enabled === false) return false
  const level = String(admin.level || '').toLowerCase()
  if (level === 'root' || level === 'admin') return true
  if (admin.orderManage === true) return true
  const raw = admin.perms || admin.permissions
  const list = Array.isArray(raw) ? raw.map(String) : String(raw || '').split(',')
  return list.some((p) => ['*', 'order:manage', 'orders', 'order'].includes(p.trim()))
}

async function writeAudit(admin, action, detail) {
  try {
    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action,
        detail,
        createTime: db.serverDate(),
      },
    })
  } catch (e) {
    // 日志写入失败不阻断业务，但需留痕到云函数日志
    console.error('[adminWithdrawOrder] 审计日志写入失败', e)
  }
}

// 需求单下架（业务 id 优先，兼容按 _id 的旧单）
async function withdrawDemand(demandId, patch) {
  const r = await db.collection('demands').where({ id: demandId }).update({ data: patch })
  if (!r.stats || r.stats.updated === 0) {
    try {
      await db.collection('demands').doc(demandId).update({ data: patch })
    } catch (e) {
      // 忽略：非合法文档 id（无此单或已被删）
    }
  }
}

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // ① 登录鉴权
    if (!canManageOrders(admin)) {
      return { code: -1, message: '无订单管理权限，无法执行撤回', data: null }
    } // ② 订单管理权限校验

    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const { orderId, reason = '' } = body
    if (!orderId) return { code: -1, message: '缺少订单 ID', data: null }

    let match = null
    try {
      const r = await db.collection('matches').doc(String(orderId)).get()
      match = r.data || null
    } catch (e) {
      return { code: -1, message: '订单不存在', data: null }
    }
    if (!match) return { code: -1, message: '订单不存在', data: null }

    const from = match.status
    if (from === '已撤回') {
      return { code: 0, message: 'success', data: { changed: false, from, to: '已撤回' } }
    }
    if (!WITHDRAWABLE.includes(from)) {
      return { code: -1, message: `仅「待联系 / 已联系」的未完成订单可撤回（当前：${from || '未知'}）`, data: null }
    }

    const now = db.serverDate()
    const withdrawReason = String(reason || '').trim() || '管理员撤回'

    // 1) 订单状态置「已撤回」并留痕（撤回时间 + 操作管理员账号）
    await db.collection('matches').doc(String(orderId)).update({
      data: {
        status: '已撤回',
        withdrawTime: now,
        withdrawBy: admin.username,
        withdrawReason,
        updateTime: now,
      },
    })

    // 2) 需求单整单下架：广场不再展示、家长「我的需求」不再出现（对所有普通用户隐藏）
    await withdrawDemand(match.demandId, {
      status: '已下架',
      withdrawn: true,
      applicants: 0,
      withdrawTime: now,
      withdrawBy: admin.username,
      withdrawReason,
      updateTime: now,
    })

    // 3) 作废该需求下的活跃报名（释放老师名额，避免占用 5 个报名上限）
    await db.collection('applications')
      .where({ demandId: match.demandId, status: _.in(ACTIVE_APPLICATION) })
      .update({ data: { status: '已取消', cancelTime: now } })

    // 4) 操作日志：记录撤回时间、操作管理员账号与原因
    await writeAudit(admin, 'withdraw_order', {
      orderId: String(orderId),
      demandId: match.demandId,
      teacherId: match.teacherId,
      from,
      to: '已撤回',
      reason: withdrawReason,
      operator: admin.username,
      time: new Date().toISOString(),
    })

    return { code: 0, message: 'success', data: { changed: true, from, to: '已撤回', demandId: match.demandId } }
  } catch (err) {
    console.error('[adminWithdrawOrder] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
