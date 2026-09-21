const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')
const { allocateTeacherNo } = require('./allocateTeacherNo')

// 归一化时间：优先 reviewTime（认证成功时间），其次 createTime
function ts(v) {
  const t = v && (v.reviewTime || v.createTime)
  if (!t) return 0
  if (typeof t === 'number') return t
  if (t instanceof Date) return t.getTime()
  const n = Date.parse(t)
  return Number.isNaN(n) ? 0 : n
}

/**
 * 老师专属编号的补发 + 归一化（幂等，可作为修复工具重复执行）：
 * 编号是「账号（openid）」级属性，一个账号只允许一个编号。
 * 对每个账号：
 *   1) 取该账号「最近一次通过审核」的认证记录作为正式档案（canonical）；
 *   2) 编号取值优先级：canonical.teacherNo > 该账号其它记录的编号 > teacher_users.teacherNo > 新分配；
 *   3) canonical 绑定该编号；同账号其它已通过记录释放编号并标记 superseded；
 *   4) 回写 teacher_users 与报名快照，保证「我的」页与正式档案一致。
 */
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    // 分页拉取全部已通过认证（云开发单次上限 1000）
    const all = []
    let skip = 0
    const LIMIT = 100
    for (let i = 0; i < 20; i++) {
      const r = await db
        .collection('verifications')
        .where({ status: '已通过' })
        .limit(LIMIT)
        .skip(skip)
        .get()
        .catch(() => ({ data: [] }))
      all.push(...r.data)
      if (r.data.length < LIMIT) break
      skip += LIMIT
    }

    // 按账号分组
    const byOpenid = {}
    all.forEach((v) => {
      if (!v._openid) return
      if (!byOpenid[v._openid]) byOpenid[v._openid] = []
      byOpenid[v._openid].push(v)
    })

    let assigned = 0
    let normalized = 0

    for (const openid of Object.keys(byOpenid)) {
      // 最新通过审核的记录在前（正式档案）
      const list = byOpenid[openid].sort((a, b) => ts(b) - ts(a))
      const canonical = list[0]
      const others = list.slice(1)

      // 解析该账号的编号：canonical → 其它记录 → 账号档案 → 新分配
      let no = canonical.teacherNo || ''
      if (!no) {
        const withNo = list.find((v) => v.teacherNo)
        if (withNo) no = String(withNo.teacherNo)
      }
      if (!no) {
        const uRes = await db
          .collection('teacher_users')
          .where({ _openid: openid })
          .limit(1)
          .get()
          .catch(() => ({ data: [] }))
        const u = uRes.data[0] || null
        if (u && u.teacherNo) no = String(u.teacherNo)
      }
      if (!no) {
        no = await allocateTeacherNo()
        assigned += 1
      }

      // 正式档案绑定编号
      if (canonical.teacherNo !== no || !canonical.archived) {
        await db
          .collection('verifications')
          .doc(canonical._id)
          .update({ data: { teacherNo: no, archived: true, locked: true } })
          .catch(() => null)
      }

      // 同账号历史记录：释放重复编号，避免一个账号出现两个编号
      for (const v of others) {
        if (v.teacherNo || !v.superseded) {
          await db
            .collection('verifications')
            .doc(v._id)
            .update({ data: { teacherNo: '', superseded: true } })
            .catch(() => null)
          normalized += 1
        }
      }

      // 回写账号档案与报名快照
      await db
        .collection('teacher_users')
        .where({ _openid: openid })
        .update({ data: { teacherNo: no, realNameLocked: true } })
        .catch(() => null)
      await db
        .collection('applications')
        .where({ _openid: openid })
        .update({ data: { teacherNo: no } })
        .catch(() => null)
    }

    const accounts = Object.keys(byOpenid).length
    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action: 'assign_teacher_no',
        detail: { assigned, normalized, passed: all.length, accounts },
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { assigned, normalized, passed: all.length, accounts } }
  } catch (err) {
    console.error('[assignTeacherNumbers] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
