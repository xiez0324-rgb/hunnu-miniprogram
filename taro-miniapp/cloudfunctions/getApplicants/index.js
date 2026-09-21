const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { demandId } = event
    const openid = cloud.getWXContext().OPENID

    // 数据越权防护：报名名单仅需求发布者本人可查看，避免他人凭单号拉取其他家长的报名信息
    const demandRes = await db.collection('demands').where({ id: demandId }).limit(1).get()
    let demand = demandRes.data[0] || null
    if (!demand) {
      try {
        const docRes = await db.collection('demands').doc(demandId).get()
        demand = docRes.data || null
      } catch (e) {
        demand = null
      }
    }
    if (!demand) {
      return { code: -1, message: '该需求不存在或已下架', data: null }
    }
    if (demand._openid !== openid) {
      return { code: -1, message: '无权查看该需求的报名信息', data: null }
    }

    // 该需求的所有「活跃」报名老师（家长端确认人选页：推荐置顶，其余靠后）。
    // 只返回 已报名/已推荐/已确认，排除已取消的历史记录，避免出现重复/已退出的老师
    const res = await db.collection('applications')
      .where({ demandId, status: _.in(['已报名', '已推荐', '已确认']) })
      .orderBy('createTime', 'asc')
      .get()
    // 报名记录里 teacherId 是老师业务 id，映射为前端 Teacher 所需的 id 字段
    const list = res.data.map((a) => Object.assign({}, a, { id: a.teacherId }))

    // 展示数据实时化：确认人选页 / 查看完整简历必须与老师端当前填写一致。
    // 报名记录里的字段是「报名时的快照」，老师后续修改姓名/科目/时薪/简介后不应继续展示旧值。
    const openids = [...new Set(list.map((a) => a._openid).filter(Boolean))]
    if (openids.length) {
      const [vRes, rRes] = await Promise.all([
        db.collection('verifications').where({ _openid: _.in(openids), status: '已通过' }).limit(200).get().catch(() => ({ data: [] })),
        db.collection('resumes').where({ _openid: _.in(openids) }).limit(200).get().catch(() => ({ data: [] })),
      ])
      // 每个账号只取「已颁发编号的正式档案」（历史被替代的记录不带编号，天然被跳过）
      const verifyByOpenid = {}
      ;(vRes.data || []).forEach((v) => {
        const cur = verifyByOpenid[v._openid]
        if (!cur || (!cur.teacherNo && v.teacherNo)) verifyByOpenid[v._openid] = v
      })
      const resumeByOpenid = {}
      ;(rRes.data || []).forEach((r) => {
        if (!resumeByOpenid[r._openid]) resumeByOpenid[r._openid] = r
      })

      list.forEach((a) => {
        const v = verifyByOpenid[a._openid]
        const r = resumeByOpenid[a._openid]
        if (v) {
          // 占位名（如「同学」）不覆盖已有实名，避免用历史脏数据覆盖正确展示
          if (v.name && v.name !== '同学') a.name = v.name
          if (v.college) a.college = v.college
          if (v.major) a.major = v.major
          if (v.teacherNo) a.teacherNo = v.teacherNo
          a.verified = true
        }
        if (r) {
          if (r.subjects && r.subjects[0]) a.subject = r.subjects[0]
          if (r.grades && r.grades[0]) a.meta = r.grades[0] + ' · 一对一'
          if (r.intro) a.quote = String(r.intro).slice(0, 40)
          // 时薪：优先多学段分档摘要，否则回退统一时薪（与 applyDemand 的快照规则一致）
          const parts = r.rateByStage && typeof r.rateByStage === 'object'
            ? Object.keys(r.rateByStage).filter((k) => r.rateByStage[k]).map((k) => `${k}${r.rateByStage[k]}元/时`)
            : []
          if (parts.length) a.rate = parts.join('·')
          else if (r.rate) a.rate = String(r.rate).includes('元') ? r.rate : `${r.rate} 元/时`
        }
      })
    }

    // 已确认人选：该需求下状态为「已确认」的报名老师（持久化状态，用于家长端回显与禁用重复确认）
    const confirmed = list.find((a) => a.status === '已确认') || null
    return {
      code: 0,
      message: 'success',
      data: {
        recommended: list.filter((a) => a.recommended),
        others: list.filter((a) => !a.recommended),
        confirmedTeacherId: confirmed ? confirmed.teacherId : '',
        confirmedTeacherName: confirmed ? (confirmed.name || '') : '',
      },
    }
  } catch (err) {
    console.error('[getApplicants] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
