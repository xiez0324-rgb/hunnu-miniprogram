// 管理端通用展示工具（时间格式化 / 状态标签配色映射等）

/** 服务端时间字符串 → 'YYYY-MM-DD HH:mm'，空值返回 '—' */
export function fmtTime(t?: string | null): string {
  if (!t) return '—'
  const d = new Date(t)
  if (isNaN(d.getTime())) return '—'
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 金额展示：number|string → 元 文本 */
export function fmtAmount(v?: number | string | null): string {
  if (v === undefined || v === null || v === '') return '—'
  const n = Number(v)
  return isNaN(n) ? String(v) : `${n}`
}

/** 学籍院校为平台固定合作院校，管理端统一展示学院 · 专业（旧 school 兼容解析） */
export function teacherCollegeMajorText(p?: {
  college?: string
  major?: string
  school?: string
} | null): string {
  const college = (p?.college || '').trim()
  const major = (p?.major || '').trim()
  if (college || major) return [college, major].filter(Boolean).join(' · ')
  const school = (p?.school || '').trim()
  if (!school || school === '在读大学生') return ''
  const parts = school
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length > 1) return parts.slice(1).join(' · ')
  return ''
}

const STATUS_COLOR: Record<string, string> = {
  待审核: 'amber',
  待联系: 'amber',
  待付: 'amber',
  已联系: 'blue',
  已通过: 'green',
  已成交: 'green',
  已付: 'green',
  已驳回: 'red',
  已撤回: 'red',
  已取消: 'gray',
  已下架: 'gray',
  进行中: 'green',
}

/** 状态文本 → 全局样式类后缀（与 styles/admin.scss 中 adm-tag--x 对应） */
export function statusColorClass(status?: string | null): string {
  if (!status) return 'gray'
  return STATUS_COLOR[status] || 'gray'
}

/** 费用计算方式中文说明（服务端 calcMode 可能为代码或缺失） */
export function calcModeLabel(mode?: string): string {
  if (!mode) return ''
  if (mode.includes('feeAmount') || mode.includes('金额')) return '自定义金额'
  if (mode.includes('percent') || mode.includes('费率')) return '按费率计算'
  return mode
}
