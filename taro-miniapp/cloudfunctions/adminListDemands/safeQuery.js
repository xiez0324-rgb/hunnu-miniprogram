// 集合安全查询工具（各云函数独立部署，故每个函数目录各存一份）
// 背景：新环境或误删集合时，直接查询会抛 -502005
//      「collection.get:fail -502005 database collection not exists.[ResourceNotFound]」，
//      导致整个接口 500（如管理员处理「待联系订单」时因 parent_users 缺失而失败）。
// 处理：命中集合缺失 → 自动创建集合 → 重试一次；仍失败则降级为空结果，保证主流程可用。

function isCollectionMissing(e) {
  const msg = String((e && (e.errMsg || e.message)) || '')
  return Boolean(e && e.errCode === -502005) || /collection not exists|Db or Table not exist|ResourceNotFound/i.test(msg)
}

/**
 * 安全查询：集合缺失时自动创建并重试一次，仍失败返回 { data: [] }
 * @param {object} db 云数据库实例
 * @param {string} name 集合名
 * @param {() => Promise<{ data: any[] }>} run 实际查询
 * @param {string} tag 日志标识（一般是云函数名）
 */
async function safeGet(db, name, run, tag = 'safeGet') {
  try {
    return await run()
  } catch (e) {
    if (isCollectionMissing(e)) {
      console.warn(`[${tag}] 集合 ${name} 不存在，尝试自动创建`)
      try {
        await db.createCollection(name)
      } catch (err) {
        /* 已存在或并发创建：忽略 */
      }
      try {
        return await run()
      } catch (e2) {
        console.error(`[${tag}] 集合 ${name} 重试仍失败：`, e2)
      }
    } else {
      console.error(`[${tag}] 集合 ${name} 查询失败：`, e)
    }
    return { data: [] }
  }
}

module.exports = { isCollectionMissing, safeGet }
