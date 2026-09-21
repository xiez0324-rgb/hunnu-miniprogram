// mock: login 云函数
import type { UserInfo } from '@/types'

export default function login(data: { role: string; nickname?: string }): UserInfo {
  const role = data.role === 'parent' ? 'parent' : 'teacher'
  return {
    openid: `openid_${Date.now()}`,
    nickname: data.nickname || (role === 'parent' ? '家长用户' : '同学'),
    avatar: '',
    role,
    phone: '',
  }
}
