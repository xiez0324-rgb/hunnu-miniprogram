const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 站内信（消息通知）读写：
 * - list：返回本人（按 _openid 隔离）的通知列表与未读数
 * - markRead：单条标记已读
 * - markAllRead：全部标记已读
 */
exports.main = async (event, context) => {
  try {
    const openid = cloud.getWXContext().OPENID
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const action = body.action || 'list'
    const col = db.collection('notices')

    if (action === 'markRead' && body.id) {
      await col
        .where({ _id: String(body.id), _openid: openid })
        .update({ data: { read: true, readTime: db.serverDate() } })
        .catch(() => null)
      return { code: 0, message: 'success', data: { ok: true } }
    }

    if (action === 'markAllRead') {
      await col
        .where({ _openid: openid, read: false })
        .update({ data: { read: true, readTime: db.serverDate() } })
        .catch(() => null)
      return { code: 0, message: 'success', data: { ok: true } }
    }

    // 集合尚未创建时视为「暂无通知」，不抛错
    const res = await col
      .where({ _openid: openid })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
      .catch(() => ({ data: [] }))

    const list = res.data.map((n) => ({
      id: n._id,
      type: n.type || '',
      title: n.title || '通知',
      content: n.content || '',
      role: n.role || '',
      demandId: n.demandId || '',
      read: !!n.read,
      createTime: n.createTime || null,
    }))

    return {
      code: 0,
      message: 'success',
      data: { list, unread: list.filter((n) => !n.read).length },
    }
  } catch (err) {
    console.error('[getNotices] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
