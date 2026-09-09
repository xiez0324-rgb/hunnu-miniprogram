const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 解析种子字符串时间（兼容 '2026-08-30 10:24' 与 ISO 字符串），返回本地时区 Date
function parseSeedTime(str) {
  const m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
}

exports.main = async (event, context) => {
  try {
    const only = event && event.demandIds // 可选：只迁移指定单号（数组），便于定向修复
    const col = db.collection('demands')

    const countRes = await col.count()
    const total = countRes.total
    const PAGE = 100
    const migrated = []
    let updated = 0
    let skipped = 0

    for (let offset = 0; offset < total; offset += PAGE) {
      const res = await col.skip(offset).limit(PAGE).get()
      for (const doc of res.data) {
        if (only && only.length > 0 && !only.includes(doc.id)) continue
        if (typeof doc.createTime === 'string') {
          const t = parseSeedTime(doc.createTime)
          if (t) {
            await col.doc(doc._id).update({ data: { createTime: t } })
            updated++
            migrated.push(doc.id || doc._id)
          } else {
            skipped++
          }
        }
      }
    }

    return {
      code: 0,
      message: 'success',
      data: { total, updated, skipped, migrated },
    }
  } catch (err) {
    console.error('[migrateSeedData] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
