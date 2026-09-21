const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')

async function safeCount(col, where = {}) {
  try {
    const r = await db.collection(col).where(where).count()
    return r.total
  } catch (e) {
    return 0
  }
}

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权：非管理员直接抛 FORBIDDEN

    const [
      demands,
      activeDemands,
      demandAuditPending,
      applications,
      matchPending,
      matchContacted,
      matchDealt,
      matchCancelled,
      matchWithdrawn,
      verifyPending,
      inquiryPending,
      teacherUsers,
      parentUsers,
      feeSummary,
    ] = await Promise.all([
      safeCount('demands'),
      safeCount('demands', { status: '进行中' }),
      safeCount('demands', { auditStatus: '待审核' }),
      safeCount('applications', { status: '已报名' }),
      safeCount('matches', { status: '待联系' }),
      safeCount('matches', { status: '已联系' }),
      safeCount('matches', { status: '已成交' }),
      safeCount('matches', { status: '已取消' }),
      safeCount('matches', { status: '已撤回' }),
      safeCount('verifications', { status: '待审核' }),
      safeCount('inquiries', { status: '待处理' }),
      safeCount('teacher_users'),
      safeCount('parent_users'),
      (async () => {
        // 信息费汇总（集合量小，全量取出统计）
        let feePendingCount = 0
        let feePendingSum = 0
        let feePaidCount = 0
        try {
          const feeRes = await db.collection('fee_records').get()
          feeRes.data.forEach((f) => {
            if (f.status === '待付') {
              feePendingCount++
              feePendingSum += Number(f.fee8) || 0
            } else if (f.status === '已付') {
              feePaidCount++
            }
          })
        } catch (e) {
          // fee_records 未初始化时忽略
        }
        return { feePendingCount, feePendingSum, feePaidCount }
      })(),
    ])

    return {
      code: 0,
      message: 'success',
      data: {
        operator: { username: admin.username, level: admin.level },
        demands,
        activeDemands,
        demandAuditPending,
        applications,
        matches: {
          待联系: matchPending,
          已联系: matchContacted,
          已成交: matchDealt,
          已取消: matchCancelled,
          已撤回: matchWithdrawn,
        },
        verifications: { 待审核: verifyPending },
        inquiries: { 待处理: inquiryPending },
        fee: { 待付: feeSummary.feePendingCount, 待付金额: feeSummary.feePendingSum, 已付: feeSummary.feePaidCount },
        users: { teacher: teacherUsers, parent: parentUsers },
      },
    }
  } catch (err) {
    console.error('[adminDashboard] error:', err)
    if (err.code === 'FORBIDDEN') {
      return { code: -1, message: '无管理员权限', data: null }
    }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
