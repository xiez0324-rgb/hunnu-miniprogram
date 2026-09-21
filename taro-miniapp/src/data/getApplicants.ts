// mock: getApplicants 云函数（家长确认人选页：推荐置顶 + 其他 + 已确认人选）
import type { Applicant } from '@/types'
import { applicantsByDemand, confirmedByDemand } from './shared'

export default function getApplicants(data: { demandId: string }): {
  recommended: Applicant[]
  others: Applicant[]
  confirmedTeacherId: string
  confirmedTeacherName: string
} {
  const list = applicantsByDemand[data.demandId] || []
  const confirmedTeacherId = confirmedByDemand[data.demandId] || ''
  const confirmedTeacherName =
    list.find((a) => a.id === confirmedTeacherId)?.name || ''
  return {
    recommended: list.filter((a) => a.recommended),
    others: list.filter((a) => !a.recommended),
    confirmedTeacherId,
    confirmedTeacherName,
  }
}
