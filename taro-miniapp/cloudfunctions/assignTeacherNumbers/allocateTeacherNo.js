const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 老师专属编号：计数器集合与文档
const COUNTER_COLLECTION = 'counters'
const TEACHER_NO_DOC = 'teacher_no'
// 起始基数：编号 = 10000 + seq，从 10001 起，保证恒为 5 位数字
const TEACHER_NO_BASE = 10000

/**
 * 分配老师专属 5 位编号：按认证成功先后顺序依次累加。
 * 生成后与 verifications / teacher_users 双表比对去重，确保全局唯一。
 */
async function allocateTeacherNo() {
  let seq = 0
  try {
    const r = await db.collection(COUNTER_COLLECTION).doc(TEACHER_NO_DOC).get()
    seq = Number((r.data && r.data.seq) || 0)
  } catch (e) {
    seq = 0
  }
  let cursor = seq
  let no = ''
  for (let i = 0; i < 200; i++) {
    cursor += 1
    const candidate = String(TEACHER_NO_BASE + cursor)
    // 三表比对去重：认证记录 / 老师账号 / 平台种子老师，确保全局唯一
    const [v, u, t] = await Promise.all([
      db.collection('verifications').where({ teacherNo: candidate }).count().catch(() => ({ total: 0 })),
      db.collection('teacher_users').where({ teacherNo: candidate }).count().catch(() => ({ total: 0 })),
      db.collection('teachers').where({ teacherNo: candidate }).count().catch(() => ({ total: 0 })),
    ])
    if (!v.total && !u.total && !t.total) {
      no = candidate
      break
    }
  }
  if (!no) throw new Error('老师编号分配失败，请稍后重试')
  const payload = { data: { seq: cursor, updateTime: db.serverDate() } }
  try {
    await db.collection(COUNTER_COLLECTION).doc(TEACHER_NO_DOC).set(payload)
  } catch (e) {
    // 集合尚未创建（新环境）：建表后重试一次
    try {
      await db.createCollection(COUNTER_COLLECTION)
    } catch (err) {
      /* 已存在或并发创建：忽略 */
    }
    await db.collection(COUNTER_COLLECTION).doc(TEACHER_NO_DOC).set(payload)
  }
  return no
}

module.exports = { allocateTeacherNo }
