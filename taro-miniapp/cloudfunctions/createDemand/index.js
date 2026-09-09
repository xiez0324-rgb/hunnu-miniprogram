const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { grade, subject, category, title, goal, time, budget, area, gender, phone, note } = event
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

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
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { id } }
  } catch (err) {
    console.error('[createDemand] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
