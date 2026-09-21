import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useUser } from '@/store/user'
import { callFunction } from '@/services/cloud'
import ConfirmDialog from '@/components/ConfirmDialog'
import { isPlaceholderNickname } from '@/utils/nickname'
import type { Profile } from '@/types'
import styles from './index.module.scss'

// 家长基础信息是否完备：
// 「同学」是老师角色未命名时的默认称呼，不作为家长已完善的依据；
// 家长需至少设置了性别 / 自定义称呼 / 电话 / 区域 之一，才算完善过
function isProfileComplete(p: Profile | null): boolean {
  if (!p) return false
  return Boolean(!isPlaceholderNickname(p.nickname) || p.gender || (p.phone || '').trim() || (p.area || '').trim())
}

export default function RoleSelectPage() {
  const { switchRole } = useUser()
  const [guideVisible, setGuideVisible] = useState(false)

  // 家长首次完成注册后：强制弹出引导，优先进入「我的」页完善个人基础信息
  const maybeGuideParent = async (): Promise<boolean> => {
    let shown = false
    try {
      shown = Taro.getStorageSync('parent_guide_shown') === 1
    } catch (err) {
      /* 忽略读取失败 */
    }
    if (shown) return false
    try {
      const res = await callFunction<{ profile: Profile | null }>('getProfile', { role: 'parent' })
      if (isProfileComplete(res.profile)) return false
    } catch (err) {
      // 云端异常时仍弹一次引导，避免家长漏掉完善入口
    }
    return true
  }

  const pick = async (role: 'parent' | 'teacher') => {
    switchRole(role)
    if (role === 'parent' && (await maybeGuideParent())) {
      setGuideVisible(true)
      return
    }
    Taro.switchTab({ url: '/pages/home/index' })
  }

  const goGuide = () => {
    try {
      Taro.setStorageSync('parent_guide_shown', 1)
    } catch (err) {
      /* ignore */
    }
    setGuideVisible(false)
    Taro.switchTab({ url: '/pages/mine/index' })
  }

  const dismissGuide = () => {
    try {
      Taro.setStorageSync('parent_guide_shown', 1)
    } catch (err) {
      /* ignore */
    }
    setGuideVisible(false)
    Taro.switchTab({ url: '/pages/home/index' })
  }

  return (
    <View className={styles.page}>
      <Text className={styles.title}>你是？</Text>
      <Text className={styles.subtitle}>后续可在「我的」页切换身份</Text>

      <View className={styles.grid}>
        <View className={styles.roleCard} onClick={() => pick('parent')}>
          <Text className={styles.roleIcon}>🏠</Text>
          <Text className={styles.roleName}>我是家长</Text>
          <Text className={styles.roleDesc}>有需求</Text>
        </View>
        <View className={styles.roleCard} onClick={() => pick('teacher')}>
          <Text className={styles.roleIcon}>🎓</Text>
          <Text className={styles.roleName}>我是老师</Text>
          <Text className={styles.roleDesc}>来接单</Text>
        </View>
      </View>

      <View className={styles.adminEntry} onClick={() => Taro.navigateTo({ url: '/pages/admin/login/index' })}>
        <Text className={styles.adminEntryText}>管理后台入口（仅限管理员）</Text>
      </View>

      <ConfirmDialog
        visible={guideVisible}
        title="完善个人资料"
        content="欢迎使用小小陪伴帮！为方便平台工作人员尽快为您匹配合适老师，建议先进入「我的」页完善称呼、性别、联系电话等基础信息（进入小程序不会索取任何信息，仅在与您对接时使用）。"
        confirmText="去完善资料"
        cancelText="稍后再说"
        onConfirm={goGuide}
        onCancel={dismissGuide}
      />
    </View>
  )
}
