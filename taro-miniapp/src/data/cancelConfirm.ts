// mock: cancelConfirm 云函数（家长取消已确认人选，释放该需求的有效匹配）
export default function cancelConfirm(_data: { demandId: string; teacherId: string }): {
  ok: boolean
} {
  return { ok: true }
}
