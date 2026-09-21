import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import type { Profile, Role, UserGender, UserInfo } from '@/types'

interface UserContextValue {
  user: UserInfo | null
  role: Role | null
  unread: number
  setUnread: (n: number) => void
  login: (role: Role, nickname?: string, code?: string) => Promise<void>
  logout: () => void
  switchRole: (role: Role) => void
  refreshProfile: (role?: Role) => Promise<void>
}

const UserContext = createContext<UserContextValue>({
  user: null,
  role: null,
  unread: 0,
  setUnread: () => {},
  login: async () => {},
  logout: () => {},
  switchRole: () => {},
  refreshProfile: async () => {},
})

function mergeUserState(
  prev: UserInfo | null,
  patch: Partial<UserInfo>
): UserInfo | null {
  if (!prev) return prev
  const next = { ...prev, ...patch }
  try {
    Taro.setStorageSync('user', next)
  } catch (err) {
    console.error('[User] 保存登录态失败', err)
  }
  return next
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [unread, setUnreadState] = useState<number>(() => {
    try {
      const n = Taro.getStorageSync('unread')
      return typeof n === 'number' ? n : 0
    } catch (err) {
      return 0
    }
  })

  // 启动时读取本地登录态
  useEffect(() => {
    try {
      const cached = Taro.getStorageSync('user')
      if (cached) {
        setUser(cached)
      }
    } catch (err) {
      console.error('[User] 读取登录态失败', err)
    }
  }, [])

  const setUnread = useCallback((n: number) => {
    setUnreadState(n)
    try {
      Taro.setStorageSync('unread', n)
    } catch (err) {
      console.error('[User] 保存未读数失败', err)
    }
  }, [])

  // 从云端拉取本人档案，把昵称/性别/电话/区域同步到本地登录态
  // （「我的」页顶部昵称与个人信息页共用同一数据源，保证两处一致）
  // role 必传：家长/老师档案已分表（parent_users/teacher_users），
  // 必须按当前身份路由，避免拉错另一身份的档案
  const refreshProfile = useCallback(async (role?: Role) => {
    try {
      const res = await callFunction<{ profile: Profile | null }>('getProfile', {
        role: role || (Taro.getStorageSync('user')?.role as Role) || 'teacher',
      })
      const p = res.profile
      if (!p) return
      setUser((prev) =>
        mergeUserState(prev, {
          nickname: p.nickname || '',
          gender: (p.gender as UserGender) || undefined,
          phone: p.phone || '',
          area: p.area || '',
          teacherNo: p.teacherNo || '',
        })
      )
    } catch (err) {
      console.error('[User] 同步个人信息失败', err)
    }
  }, [])

  const login = useCallback(async (role: Role, nickname?: string, code?: string) => {
    try {
      const info = await callFunction<UserInfo>('login', { role, nickname, code })
      setUser({ ...info, gender: info.gender || undefined })
      Taro.setStorageSync('user', { ...info, gender: info.gender || undefined })
      // 登录后同步档案（性别/昵称以对应角色表为准）
      refreshProfile(role)
    } catch (err) {
      console.error('[User] 登录失败', err)
      // 降级：本地登录
      const fallback: UserInfo = {
        openid: `openid_${Date.now()}`,
        nickname: nickname || (role === 'parent' ? '家长用户' : '同学'),
        avatar: '',
        role,
        phone: '',
      }
      setUser(fallback)
      Taro.setStorageSync('user', fallback)
    }
  }, [refreshProfile])

  const logout = useCallback(() => {
    setUser(null)
    try {
      Taro.removeStorageSync('user')
    } catch (err) {
      console.error('[User] 清除登录态失败', err)
    }
  }, [])

  // 切换身份：本地即时生效，同时把角色持久化到云端 users 文档
  const switchRole = useCallback(
    (role: Role) => {
      setUser((prev) => {
        const next = prev
          ? { ...prev, role }
          : { openid: '', nickname: '', avatar: '', role, phone: '' }
        try {
          Taro.setStorageSync('user', next)
        } catch (err) {
          console.error('[User] 切换角色失败', err)
        }
        // 异步持久化角色（不阻塞 UI），完成后拉取该身份档案让昵称/性别即时同步
        callFunction('login', { role })
          .then(() => refreshProfile(role))
          .catch((err) => {
            console.error('[User] 云端角色同步失败', err)
          })
        return next
      })
    },
    [refreshProfile]
  )

  return (
    <UserContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        unread,
        setUnread,
        login,
        logout,
        switchRole,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
