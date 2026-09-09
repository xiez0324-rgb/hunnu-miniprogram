// 仅保留数字字符
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

// 按性别生成家长通用称呼前缀（我的页顶部默认昵称，如 女士/男士）
export function parentGenderLabel(gender?: string): string {
  return gender === '男' ? '男士' : '女士'
}

// 我的页顶部未自定义昵称时的兜底称呼：
// 有性别 → 女士/男士；未设置性别 → 用中性的「家长」，避免误标注
export function parentFallbackName(gender?: string): string {
  return gender === '男' || gender === '女' ? parentGenderLabel(gender) : '家长'
}

// 老师身份展示文本：平台合作院校固定为湖南师范大学，对家长统一不展示学校名称，
// 只展示老师认证时录入的「学院 · 专业」。
// 兼容历史数据：旧记录 school 形如「湖南大学 · 数学系」（校名+院系混写），
// 这里去掉首段校名仅保留后半段；纯校名或「在读大学生」等占位则返回空串。
export function teacherCollegeMajorText(p?: { college?: string; major?: string; school?: string }): string {
  const college = (p?.college || '').trim()
  const major = (p?.major || '').trim()
  if (college || major) return [college, major].filter(Boolean).join(' · ')
  const school = (p?.school || '').trim()
  if (!school || school === '在读大学生') return ''
  const parts = school.split('·').map((s) => s.trim()).filter(Boolean)
  if (parts.length > 1) return parts.slice(1).join(' · ')
  return ''
}

// 简单时间格式化
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${d.getMonth() + 1}-${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 生成本地唯一 id
export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
