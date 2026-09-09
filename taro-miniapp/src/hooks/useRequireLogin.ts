import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useUser } from '@/store/user'

// 未登录/无角色时跳回登录页
export function useRequireLogin() {
  const { user } = useUser()
  useEffect(() => {
    if (!user) {
      Taro.redirectTo({ url: '/pages/login/index' })
    }
  }, [user])
}
