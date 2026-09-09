// mock: getDemands 云函数（需求广场）
import type { Demand } from '@/types'
import { demands } from './shared'

export default function getDemands(data: { filter?: string }): { demands: Demand[] } {
  const filter = data.filter || '全部'
  const list = demands.filter((d) => {
    if (filter === '全部') return true
    if (['体育', '艺术', '编程'].includes(filter)) return d.category === filter
    return d.subject === filter
  })
  return { demands: list }
}
