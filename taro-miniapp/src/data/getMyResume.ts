// mock: getMyResume 云函数（老师端读取自己的简历用于编辑回填 + 基础身份信息）
import type { Resume } from '@/types'
import { teacherResumes } from './shared'

export default function getMyResume(): {
  resume: Resume | null
  profile: { gender: string; teacherNo: string }
} {
  // H5 演示：返回示例老师简历（含多学段分档薪资示例）+ 基础身份信息
  return {
    resume: teacherResumes['t1'] || null,
    profile: { gender: '男', teacherNo: '10001' },
  }
}
