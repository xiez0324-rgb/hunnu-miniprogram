// mock: getApplicants 云函数（家长确认人选页：推荐置顶 + 其他）
import type { Applicant } from '@/types'
import { applicantsByDemand } from './shared'

export default function getApplicants(data: { demandId: string }): {
  recommended: Applicant[]
  others: Applicant[]
} {
  const list = applicantsByDemand[data.demandId] || []
  return {
    recommended: list.filter((a) => a.recommended),
    others: list.filter((a) => !a.recommended),
  }
}
