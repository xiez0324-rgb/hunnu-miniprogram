// mock: getMyData 云函数（老师我的报名 / 家长我的需求）
import type { Application, Demand } from '@/types'
import { myApplies, demands } from './shared'

export default function getMyData(data: {
  role: 'parent' | 'teacher'
  status?: string
}): { list: Application[] | Demand[] } {
  if (data.role === 'teacher') {
    const status = data.status || '全部'
    const list =
      status === '全部' ? myApplies : myApplies.filter((a) => a.status === status)
    return { list }
  }
  return { list: demands.slice(0, 2) }
}
