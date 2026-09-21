// 昵称占位与展示约定：
// 用户未自定义称呼前，系统统一使用「同学」作为老师端默认称呼；
// 历史数据里可能残留「张同学 / 王女士 / 老师用户 / 家长用户」等演示名，一并视为「未命名」。
export const PLACEHOLDER_NICKNAMES = ['同学', '张同学', '老师用户', '家长用户', '王女士']

/** 是否属于「未命名」状态（空 或 系统占位名） */
export function isPlaceholderNickname(nick?: string | null): boolean {
  const v = (nick || '').trim()
  return !v || PLACEHOLDER_NICKNAMES.includes(v)
}

/** 展示用称呼：未命名时返回兜底称呼（默认「同学」） */
export function displayNickname(nick?: string | null, fallback = '同学'): string {
  const v = (nick || '').trim()
  return isPlaceholderNickname(v) ? fallback : v
}
