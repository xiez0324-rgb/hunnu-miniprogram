// mock: cancelApplication 云函数（取消报名，不限次数，数据留存）
export default function cancelApplication(_data: { applicationId: string }): { ok: boolean } {
  return { ok: true }
}
