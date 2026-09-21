const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { checkTexts, SCENE } = require('./contentCheck')

exports.main = async (event, context) => {
  try {
    const { grade, subject, category, title, goal, time, budget, area, gender, phone, note } = event
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // 联系电话必填：发布需求必须能联系到家长，服务端与前端双保险
    if (!phone || !/^1\d{10}$/.test(String(phone).trim())) {
      return { code: -1, message: '请填写正确的 11 位联系电话（平台需与您对接）', data: null }
    }

    // 内容安全检测：对提交的自由文本做违规内容过滤（不通过则由人工复核兜底）
    const riskMsg = await checkTexts([subject, goal, title, note, area, time], openid, SCENE.资料)
    if (riskMsg) {
      return { code: -1, message: riskMsg, data: null }
    }

    // 8 位需求单号：小写字母 + 数字（剔除易混淆的 0/o/1/l/i，便于后台辨识与人工转述），
    // 随机生成 + 写入前查重兜底。全站以 id 字段关联需求（详情/报名/报名记录 demandId），后台可精确检索。
    const ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789'
    let id = ''
    for (let attempt = 0; attempt < 8; attempt++) {
      id = Array.from({ length: 8 }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join('')
      const dup = await db.collection('demands').where({ id }).count()
      if (dup.total === 0) break
      id = ''
    }
    if (!id) {
      return { code: -1, message: '单号生成失败，请重试', data: null }
    }

    const res = await db.collection('demands').add({
      data: {
        _openid: openid,
        // 显式记录发布者 openid：后台按 parentOpenid 关联 parent_users 取家长联系方式
        // （历史数据无此字段，后台已按 _openid 兜底，见 adminListDemands）
        parentOpenid: openid,
        id,
        grade,
        subject,
        category,
        title,
        goal,
        time,
        budget,
        area,
        gender,
        phone,
        note,
        applicants: 0,
        recommended: 0,
        status: '进行中',
        // 先审后发：新发布的需求默认「待审核」，管理员审核通过后才在需求广场展示
        auditStatus: '待审核',
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { id } }
  } catch (err) {
    console.error('[createDemand] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
