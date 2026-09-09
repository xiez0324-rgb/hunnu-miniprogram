// mock: requestTeacherInfo 云函数（家长"想进一步了解该老师"→通知代理人）
export default function requestTeacherInfo(_data: { demandId: string; teacherId: string }): {
  ok: boolean
} {
  return { ok: true }
}
