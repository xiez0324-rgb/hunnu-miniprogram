// 老师个人信息「两端对齐」的单一事实来源：
// 老师端（简历管理 / 个人信息）录入 → 云函数落库 → 家长端（老师简历）展示。
// 这里集中定义字段规格、归一化与完整性校验，老师端与家长端共用同一套规则，
// 避免后续任何一端单独调整导致展示偏差或数据断层。
import type { Resume, StageRates } from '@/types'

// 教龄选项（老师端单选项，家长端原样展示）
export const TEACHING_YEAR_OPTIONS = ['1 年以内', '1-3 年', '3-5 年', '5 年以上']

// 字段长度 / 数量上限（老师端校验与云函数写入校验保持一致）
export const PROFILE_LIMITS = {
  intro: 500,
  experience: 300,
  districts: 6,
  certificates: 10,
  teachingYears: 20,
}

// 列表型字段的分隔符（老师端输入时用顿号 / 逗号 / 分号分隔）
const LIST_SEPARATOR = /[、，,;；]/

/** 把老师端输入的文本拆成去空的列表（用于可服务区域、资质证书） */
export function splitList(text?: string): string[] {
  return (text || '')
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 列表转回老师端可编辑文本 */
export function joinList(list?: string[] | string): string {
  if (Array.isArray(list)) return list.join('、')
  return (list || '').trim()
}

/** 兼容历史数据：统一转成去空字符串数组 */
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === 'string') return splitList(v)
  return []
}

/** 分学段时薪归一化：仅保留 'min-max' 形式且两端都有效的档位 */
function toStageRates(v: unknown): StageRates | undefined {
  if (!v || typeof v !== 'object') return undefined
  const next: StageRates = {}
  Object.entries(v as Record<string, unknown>).forEach(([stage, range]) => {
    const text = String(range || '').trim()
    if (text && text.includes('-')) next[stage as keyof StageRates] = text
  })
  return Object.keys(next).length ? next : undefined
}

/**
 * 归一化后的简历结构：所有字段都有确定类型（列表恒为数组、文本恒为字符串），
 * 老师端回填与家长端展示都以它为准。
 */
export interface NormalizedResume {
  subjects: string[]
  grades: string[]
  timeSlots: string[]
  rate: string
  rateByStage?: StageRates
  districts: string[]
  intro: string
  teachingYears: string
  experience: string
  certificates: string[]
}

/**
 * 简历归一化：老师端回填、家长端展示、云函数下发统一走这里。
 * 保证两端看到的是同一份结构（数组恒为数组、字符串恒为字符串），
 * 即使历史数据格式不规范（如 districts 存了字符串）也不会导致一端渲染异常。
 */
export function normalizeResume(raw?: Partial<Resume> | null): NormalizedResume {
  const r = raw || {}
  return {
    subjects: toList(r.subjects),
    grades: toList(r.grades),
    timeSlots: toList(r.timeSlots),
    rate: String(r.rate || '').trim(),
    rateByStage: toStageRates(r.rateByStage),
    districts: toList(r.districts),
    intro: String(r.intro || '').trim(),
    teachingYears: String(r.teachingYears || '').trim(),
    experience: String(r.experience || '').trim(),
    certificates: toList(r.certificates),
  }
}

/**
 * 两端信息一致性自检：家长端会展示、但老师端当前尚未填写的字段。
 * 老师端据此提示补齐，家长端据同一份规格渲染「未填写」占位，
 * 从机制上避免出现「家长端可展示、老师端无录入」的字段。
 */
export function resumeMissingFields(resume: NormalizedResume, gender?: string): string[] {
  const missing: string[] = []
  if (!gender) missing.push('性别')
  if (!resume.subjects.length) missing.push('可服务科目')
  if (!resume.grades.length) missing.push('可服务年级')
  if (!resume.timeSlots.length) missing.push('可服务时段')
  if (!resume.districts.length) missing.push('可服务区域')
  if (!resume.rate && !resume.rateByStage) missing.push('期望时薪')
  if (!resume.teachingYears) missing.push('教龄')
  if (!resume.experience) missing.push('工作经历')
  if (!resume.certificates.length) missing.push('资质证书')
  if (!resume.intro) missing.push('个人简介')
  return missing
}

/**
 * 老师端提交前的字段规格校验（与云函数 saveResume 的校验保持一致，双保险）。
 * 两端共用同一套规则：老师端能保存成功的简历，家长端一定能完整展示。
 * 返回错误文案，通过则返回 null。
 */
export function validateResumeSpec(input: {
  subjects: string[]
  grades: string[]
  timeSlots: string[]
  districts: string[]
  rate: string
  rateByStage: StageRates
  intro: string
  teachingYears: string
  experience: string
  certificates: string[]
}): string | null {
  if (!input.subjects.length) return '请至少选择一个服务科目'
  if (!input.grades.length) return '请至少选择一个服务年级'
  if (!input.timeSlots.length) return '请至少选择一个可服务时段'
  if (!input.districts.length) return '请填写可服务区域'
  if (input.districts.length > PROFILE_LIMITS.districts) {
    return `可服务区域最多 ${PROFILE_LIMITS.districts} 个`
  }
  if (input.teachingYears.length > PROFILE_LIMITS.teachingYears) return '教龄内容过长'
  if (input.experience.length > PROFILE_LIMITS.experience) {
    return `工作经历不能超过 ${PROFILE_LIMITS.experience} 字`
  }
  if (input.certificates.length > PROFILE_LIMITS.certificates) {
    return `资质证书最多 ${PROFILE_LIMITS.certificates} 项`
  }
  if (!input.intro) return '请填写自我介绍'
  if (input.intro.length > PROFILE_LIMITS.intro) {
    return `自我介绍不能超过 ${PROFILE_LIMITS.intro} 字`
  }

  // 统一时薪：可留空（改用分档），填写时需为 20~600 的整数
  if (input.rate) {
    if (!/^\d+$/.test(input.rate)) return '统一时薪仅支持数字'
    const n = Number(input.rate)
    if (n < 20 || n > 600) return '统一时薪需在 20~600 元/时之间'
  }

  // 分学段区间：可整段不填；填了则两端必填且 min<=max
  const stages = Object.keys(input.rateByStage) as Array<keyof StageRates>
  if (!input.rate && !stages.length) return '请填写统一时薪，或至少为一个学段配置薪资区间'
  for (const k of stages) {
    const [min, max] = String(input.rateByStage[k]).split('-')
    if (!min || !max) return `${k}档薪资区间不完整，请同时填写最低/最高时薪`
    const lo = Number(min)
    const hi = Number(max)
    if (lo < 20 || hi > 600) return `${k}档薪资需在 20~600 元/时之间`
    if (lo > hi) return `${k}档最低时薪不能高于最高时薪`
  }
  return null
}
