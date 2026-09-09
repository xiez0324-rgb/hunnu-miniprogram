const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 增减需求单报名人数。优先按业务 id；兼容早期无 id 字段、以 _id 访问的单
async function changeDemandApplicants(demandId, delta) {
  const upd = await db.collection('demands').where({ id: demandId }).update({
    data: { applicants: _.inc(delta) },
  })
  if (!upd.stats || upd.stats.updated === 0) {
    try {
      await db.collection('demands').doc(demandId).update({
        data: { applicants: _.inc(delta) },
      })
    } catch (e) {
      // demandId 非合法文档 id（无此单或已被删），忽略
    }
  }
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { demandId } = event

    // 同需求同老师只允许一条「有效」报名：存在活跃记录（非已取消）则拦截；
    // 若只剩「已取消」历史记录，则在下方复用该条恢复报名，避免集合里堆积相同老师（家长端出现重复老师）
    const exists = await db.collection('applications').where({ demandId, _openid: openid }).get()
    const active = exists.data.find((r) => r.status !== '已取消')
    if (active) {
      return { code: -1, message: '该需求已报名，不可重复报名', data: null }
    }
    const cancelled = exists.data.find((r) => r.status === '已取消') || null

    // 报名中订单上限 5 个（复用旧记录同样占用名额，一并校验）
    const activeCount = await db.collection('applications').where({ _openid: openid, status: _.in(['已报名', '已推荐']) }).count()
    if (activeCount.total >= 5) {
      return { code: -1, message: '报名中的需求已达 5 个上限', data: null }
    }

    // 组装老师资料快照（认证 + 简历，缺省用占位），供家长确认页展示完整老师卡片
    const verifyRes = await db.collection('verifications').where({ _openid: openid, status: '已通过' }).get()
    const resumeRes = await db.collection('resumes').where({ _openid: openid }).get()
    const verify = verifyRes.data[0] || null
    const resume = resumeRes.data[0] || null
    const teacherId = 't_' + openid.slice(-6)

    // 时薪快照：优先用多学段分档摘要（如 初中110-130元/时·高中130-150元/时），否则回退统一时薪
    let rateSnapshot = ''
    if (resume && resume.rateByStage && typeof resume.rateByStage === 'object') {
      const parts = Object.entries(resume.rateByStage)
        .filter(([, v]) => v)
        .map(([s, v]) => `${s}${v}元/时`)
      if (parts.length) rateSnapshot = parts.join('·')
    }
    if (!rateSnapshot) {
      const uniform = resume && resume.rate
      rateSnapshot = uniform ? (String(uniform).includes('元') ? uniform : `${uniform} 元/时`) : '时薪待协商'
    }

    if (cancelled) {
      // 复用已取消的历史记录：恢复「已报名」并刷新快照，避免集合里堆积相同老师
      await db.collection('applications').doc(cancelled._id).update({
        data: {
          name: (verify && verify.name) || '大学生老师',
          school: (verify && verify.school) || '在读大学生',
          subject: (resume && resume.subjects && resume.subjects[0]) || '科目待完善',
          rate: rateSnapshot,
          meta: (resume && resume.grades && resume.grades[0]) ? resume.grades[0] + ' · 一对一' : '一对一',
          quote: (resume && resume.intro) ? resume.intro.slice(0, 40) : '用心教学，耐心负责。',
          verified: !!verify,
          status: '已报名',
          recommended: false,
          cancelTime: null,
          createTime: db.serverDate(),
        },
      })
      // 复用后重新占用名额：计数 +1（与 cancelApplication 的 -1 保持平衡）
      await changeDemandApplicants(demandId, 1)
      return { code: 0, message: 'success', data: { applicationId: cancelled._id } }
    }

    const res = await db.collection('applications').add({
      data: {
        _openid: openid,
        demandId,
        teacherId,
        name: (verify && verify.name) || '大学生老师',
        school: (verify && verify.school) || '在读大学生',
        subject: (resume && resume.subjects && resume.subjects[0]) || '科目待完善',
        rate: rateSnapshot,
        meta: (resume && resume.grades && resume.grades[0]) ? resume.grades[0] + ' · 一对一' : '一对一',
        quote: (resume && resume.intro) ? resume.intro.slice(0, 40) : '用心教学，耐心负责。',
        verified: !!verify,
        status: '已报名',
        recommended: false,
        createTime: db.serverDate(),
      },
    })

    // 新增报名占用名额：计数 +1
    await changeDemandApplicants(demandId, 1)

    return { code: 0, message: 'success', data: { applicationId: res._id } }
  } catch (err) {
    console.error('[applyDemand] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
