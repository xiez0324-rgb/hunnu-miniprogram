// mock: getTeacherDetail 云函数（老师完整简历）
// 语义与云函数一致：仅在 teachers 表命中才返回；未命中返回空，由页面渲染空态，
// 不再用 teachers[0] 兜底（避免"张冠李戴"展示错误老师）
import type { Teacher, Resume } from '@/types'
import { teachers, teacherResumes } from './shared'

export default function getTeacherDetail(data: { teacherId: string }): {
  teacher: Teacher | null
  resume: Resume | null
} {
  const teacher = teachers.find((t) => t.id === data.teacherId) || null
  const resume = teacher ? teacherResumes[teacher.id] || null : null
  return { teacher, resume }
}
