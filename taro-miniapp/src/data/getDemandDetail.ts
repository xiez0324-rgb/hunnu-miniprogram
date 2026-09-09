// mock: getDemandDetail 云函数（需求详情）
import type { Demand } from '@/types'
import { demands } from './shared'

export default function getDemandDetail(data: { demandId: string }): { demand: Demand } {
  const demand = demands.find((d) => d.id === data.demandId) || demands[0]!
  return { demand }
}
