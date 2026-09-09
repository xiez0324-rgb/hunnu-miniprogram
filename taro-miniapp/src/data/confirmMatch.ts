// mock: confirmMatch 云函数（家长确认人选 → 管理员收到通知）
export default function confirmMatch(_data: {
  demandId: string
  teacherId: string
}): { ok: boolean } {
  return { ok: true }
}
