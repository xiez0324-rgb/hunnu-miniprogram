// mock: getTeachers 云函数（认证老师列表）
import type { Teacher } from '@/types'
import { teachers } from './shared'

export default function getTeachers(): { teachers: Teacher[] } {
  return { teachers }
}
