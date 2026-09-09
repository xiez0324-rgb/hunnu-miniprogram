// mock: submitVerification 云函数（学籍认证提交）
// authorized：是否授权在简历中展示学校名称（对应后台「授权在简历中展示学校名称」）
export default function submitVerification(data?: Record<string, unknown>): { ok: boolean; authorized: boolean } {
  return { ok: true, authorized: Boolean(data?.authorized) }
}
