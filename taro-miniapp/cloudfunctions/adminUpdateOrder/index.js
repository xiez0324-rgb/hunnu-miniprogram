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

    // 2) 需求单「对外招募」联动：仅「待联系」阶段保持对外招募，
    //    进入「已联系」即停止招募（广场隐藏 + 禁止再报名），「已成交」再叠加需求状态收单；
    //    回退时同步还原，保证可逆。
    const demandPatch = {}
    if (status === '已成交') {
      demandPatch.status = '已成交'
    } else if (from === '已成交') {
      demandPatch.status = '进行中'
    }
    if (status === '待联系') {
      demandPatch.recruiting = true
    } else if (status === '已联系' || status === '已成交') {
      demandPatch.recruiting = false
    }

    // 3) 报名记录联动（尽力可逆，保证端上状态一致）
    if (status === '已成交') {
      // 成交：老师报名记录置已成交
      await appCol.where({ ...whereKey, status: '已确认' }).update({ data: { status: '已成交', dealTime: db.serverDate() } })
    } else if (from === '已成交') {
      // 从成交回退：该单老师回「已确认」
      await appCol.where({ ...whereKey, status: '已成交' }).update({ data: { status: '已确认' } })
    } else if (status === '已取消') {
      // 取消订单：释放该老师回备选池
      await appCol.where({ ...whereKey, status: '已确认' }).update({ data: { status: '已推荐' } })
    } else if (from === '已取消' && status !== '已取消') {
      // 取消后恢复：老师重新占用为「已确认」
      await appCol.where({ ...whereKey, status: '已推荐' }).update({ data: { status: '已确认' } })
    }

    // 取消订单后：若该需求下已无其它活跃订单，恢复对外招募（避免需求卡在「进行中但不再招募」的死角）
    if (status === '已取消') {
      const others = await db.collection('matches').where({
        demandId: match.demandId,
        _id: _.neq(orderId),
        status: _.in(['待联系', '已联系', '已成交']),
      }).count()
      demandPatch.recruiting = others.total === 0
    }

    if (Object.keys(demandPatch).length > 0) {
      demandPatch.updateTime = db.serverDate()
      await updateDemandStatus(match.demandId, demandPatch)
    }

    // 成交时向该老师推送站内信（消息通知）
    if (status === '已成交') {
      try {
        const [appRes, dRes] = await Promise.all([
          appCol.where(whereKey).orderBy('createTime', 'desc').limit(1).get(),
          db.collection('demands').where({ id: match.demandId }).limit(1).get(),
        ])
        const app = appRes.data[0] || null
        const d = dRes.data[0] || null
        if (app && app._openid) {
          const label = [d && d.grade, d && d.subject].filter(Boolean).join(' · ')
          await db.collection('notices').add({
            data: {
              _openid: app._openid,
              role: 'teacher',
              type: 'deal',
              title: '恭喜，已成交',
              content: `您报名的「${label || '家教需求'}」已确认成交，请与家长保持联系，按约定开展服务。`,
              demandId: match.demandId,
              teacherId: match.teacherId,
              read: false,
              createTime: db.serverDate(),
            },
          })
        }
      } catch (e) {
        console.warn('[adminUpdateOrder] 写入站内信失败', e)
      }
    }

    await writeAudit(admin, 'update_order', { orderId, demandId: match.demandId, teacherId: match.teacherId, from, to: status })

    return { code: 0, message: 'success', data: { changed: true, from, to: status } }
  } catch (err) {
    console.error('[adminUpdateOrder] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
