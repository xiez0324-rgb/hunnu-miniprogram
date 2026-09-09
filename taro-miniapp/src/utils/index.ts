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
