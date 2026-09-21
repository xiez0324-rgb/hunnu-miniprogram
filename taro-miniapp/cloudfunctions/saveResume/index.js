const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { checkTexts, SCENE } = require('./contentCheck')

// 字段规格：与前端 src/utils/teacherProfile.ts 保持一致（双保险，防止绕过前端写入脏数据）
const LIMITS = { intro: 500, experience: 300, districts: 6, certificates: 10 }
const STAGES = ['小学', '初中', '高中']

// 列表归一化：字符串按顿号/逗号/分号拆分，统一落库为数组（保证两端渲染结构一致）
function toList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  return String(v || '')
    .split(/[、，,;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// 分学段时薪：仅保留 'min-max' 形式且数值合法的档位
function toStageRates(v) {
  if (!v || typeof v !== 'object') return null
  const next = {}
  STAGES.forEach((k) => {
    const text = String(v[k] || '').trim()
    if (/^\d+-\d+$/.test(text)) next[k] = text
  })
  return Object.keys(next).length ? next : null
}

function validate(data) {
  const subjects = toList(data.subjects)
  const grades = toList(data.grades)
  const timeSlots = toList(data.timeSlots)
  const districts = toList(data.districts)
  const certificates = toList(data.certificates)
  const rate = String(data.rate || '').trim()
  const rateByStage = toStageRates(data.rateByStage)
  const intro = String(data.intro || '').trim()
  const teachingYears = String(data.teachingYears || '').trim()
  const experience = String(data.experience || '').trim()

  if (!subjects.length) return '请至少选择一个服务科目'
  if (!grades.length) return '请至少选择一个服务年级'
  if (!timeSlots.length) return '请至少选择一个可服务时段'
  if (!districts.length) return '请填写可服务区域'
  if (districts.length > LIMITS.districts) return `可服务区域最多 ${LIMITS.districts} 个`
  if (!intro) return '请填写自我介绍'
  if (intro.length > LIMITS.intro) return `自我介绍不能超过 ${LIMITS.intro} 字`
  if (experience.length > LIMITS.experience) return `工作经历不能超过 ${LIMITS.experience} 字`
  if (certificates.length > LIMITS.certificates) return `资质证书最多 ${LIMITS.certificates} 项`

  if (rate) {
    if (!/^\d+$/.test(rate)) return '统一时薪仅支持数字'
    const n = Number(rate)
    if (n < 20 || n > 600) return '统一时薪需在 20~600 元/时之间'
  }
  if (!rate && !rateByStage) return '请填写统一时薪，或至少为一个学段配置薪资区间'
  if (rateByStage) {
    for (const k of Object.keys(rateByStage)) {
      const [min, max] = rateByStage[k].split('-').map(Number)
      if (min < 20 || max > 600) return `${k}档薪资需在 20~600 元/时之间`
      if (min > max) return `${k}档最低时薪不能高于最高时薪`
    }
  }
  return null
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const errMsg = validate(event)
    if (errMsg) {
      return { code: -1, message: errMsg, data: null }
    }

    // 内容安全检测：自我介绍/工作经历/资质证书/可服务区域均为用户自由文本，先做违规内容过滤
    const riskMsg = await checkTexts(
      [
        event.intro,
        event.experience,
        ...toList(event.certificates),
        ...toList(event.districts),
      ],
      openid,
      SCENE.资料,
    )
    if (riskMsg) {
      return { code: -1, message: riskMsg, data: null }
    }

    // 全字段落库：老师端简历页录入的每一项都必须持久化，否则家长端会出现数据断层。
    // 注意：rateByStage 此前被遗漏，导致「分学段时薪」保存后丢失、家长端回退显示空洞的时薪。
    const data = {
      subjects: toList(event.subjects),
      grades: toList(event.grades),
      timeSlots: toList(event.timeSlots),
      rate: String(event.rate || '').trim(),
      rateByStage: toStageRates(event.rateByStage),
      districts: toList(event.districts),
      teachingYears: String(event.teachingYears || '').trim(),
      experience: String(event.experience || '').trim(),
      certificates: toList(event.certificates),
      intro: String(event.intro || '').trim(),
    }

    const resumes = db.collection('resumes')
    const found = await resumes.where({ _openid: openid }).get()
    if (found.data.length > 0) {
      await resumes.doc(found.data[0]._id).update({
        data: Object.assign({}, data, { updateTime: db.serverDate() }),
      })
    } else {
      await resumes.add({
        data: Object.assign({}, data, { _openid: openid, createTime: db.serverDate() }),
      })
    }

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[saveResume] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
