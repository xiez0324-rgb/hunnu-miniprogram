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

// 报名成功站内信：写一条通知给报名老师（消息通知页展示）
async function writeApplyNotice(openid, demandId, teacherId, demand) {
  try {
    const label = [demand && demand.grade, demand && demand.subject].filter(Boolean).join(' · ')
    await db.collection('notices').add({
      data: {
        _openid: openid,
        role: 'teacher',
        type: 'apply',
        title: '报名成功',
        content: `您已成功报名「${label || '家教需求'}」，等待家长查看与确认。`,
        demandId,
        teacherId,
        read: false,
        createTime: db.serverDate(),
      },
    })
  } catch (e) {
    console.warn('[applyDemand] 写入站内信失败', e)
  }
}

// 同一账号可能有多条「已通过」认证记录（重新认证后历史记录被置空并标记 superseded）：
// 必须取「已颁发编号的正式档案」，否则会把历史占位姓名（如「同学」）快照给家长端
function pickCanonicalVerify(records) {
  const list = (records || []).slice().sort((a, b) => {
    const ta = Date.parse((a && a.reviewTime) || 0) || 0
    const tb = Date.parse((b && b.reviewTime) || 0) || 0
    return tb - ta
  })
  if (!list.length) return null
  return list.find((v) => v.teacherNo) || list.find((v) => !v.superseded) || list[0]
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { demandId } = event

    // 先审后发：仅允许报名管理员审核通过、且仍在进行中的需求
    const demandRes = await db.collection('demands').where({ id: demandId }).get()
    const demand = demandRes.data[0] || null
    if (!demand) {
      return { code: -1, message: '该需求不存在或已下架', data: null }
    }
    if (demand.withdrawn === true || demand.status === '已下架') {
      return { code: -1, message: '该需求已被平台撤回，暂不可报名', data: null }
    }
    // 对外招募已关闭：已成交或管理员已标记「已联系」（recruiting=false）
    if (demand.status === '已成交' || demand.recruiting === false) {
      return { code: -1, message: '该需求已停止招募，暂不可报名', data: null }
    }
    if (demand.auditStatus && demand.auditStatus !== '已通过') {
      return { code: -1, message: '该需求正在审核中，暂不可报名', data: null }
    }

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
    const verifyRes = await db.collection('verifications').where({ _openid: openid, status: '已通过' }).limit(10).get()
    const resumeRes = await db.collection('resumes').where({ _openid: openid }).get()
    const verify = pickCanonicalVerify(verifyRes.data)
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
          school: '湖南师范大学', // 平台唯一合作院校，前端不展示；身份行用 college/major
          college: (verify && verify.college) || '',
          major: (verify && verify.major) || '',
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
      await writeApplyNotice(openid, demandId, teacherId, demand)
      return { code: 0, message: 'success', data: { applicationId: cancelled._id } }
    }

    const res = await db.collection('applications').add({
      data: {
        _openid: openid,
        demandId,
        teacherId,
        name: (verify && verify.name) || '大学生老师',
        school: '湖南师范大学', // 平台唯一合作院校，前端不展示；身份行用 college/major
        college: (verify && verify.college) || '',
        major: (verify && verify.major) || '',
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
    await writeApplyNotice(openid, demandId, teacherId, demand)

    return { code: 0, message: 'success', data: { applicationId: res._id } }
  } catch (err) {
    console.error('[applyDemand] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
