import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { useUser } from '@/store/user'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import { parentFallbackName } from '@/utils'
import { displayNickname, isPlaceholderNickname } from '@/utils/nickname'
import styles from './index.module.scss'

export default function MinePage() {
  useRequireLogin()
  const { role, user, unread, switchRole, refreshProfile } = useUser()
  const isTeacher = role === 'teacher'
  const [syncing, setSyncing] = useState(false)

  // 每次切回本页（含个人信息保存后返回）都拉取云端档案，保证顶部昵称与个人信息页实时一致
  useDidShow(() => {
    if (user && role) {
      setSyncing(true)
      refreshProfile(role).finally(() => setSyncing(false))
    }
  })

  // 顶部昵称：有自定义昵称用昵称；家长未填时默认按性别显示「女士/男士」。
  // 「同学」是未命名时的默认称呼，切到家长身份后不作为家长昵称展示
  const rawNick = (user?.nickname || '').trim()
  const customNick = isPlaceholderNickname(rawNick) ? '' : rawNick
  const displayName = isTeacher
    ? displayNickname(rawNick)
    : customNick || parentFallbackName(user?.gender)

  // 头像文字取昵称首字；无昵称时按角色兜底
  const avatarText = displayName ? displayName.slice(0, 1) : isTeacher ? '同' : '家'
  const area = (user?.area || '').trim()

  const desc = isTeacher
    ? area
      ? `${area} · 大学生家教`
      : '大学生家教 · 完善个人信息后展示所在区域'
    : area
      ? `${area} · 家长`
      : '完善个人资料后展示所在区域'

  const go = (url: string) => {
    Taro.navigateTo({ url })
  }

  const switchIdentity = () => {
    const next = isTeacher ? 'parent' : 'teacher'
    switchRole(next)
    Taro.showToast({ title: next === 'teacher' ? '已切换为老师' : '已切换为家长', icon: 'none' })
    Taro.switchTab({ url: '/pages/home/index' })
  }

  return (
    <View className={styles.page}>
      <View className={styles.profileCard}>
        <View className={styles.avatar}>
          <Text className={styles.avatarText}>{syncing ? '…' : avatarText}</Text>
        </View>
        <View className={styles.profileInfo}>
          <View className={styles.nameRow}>
            <Text className={styles.name}>{syncing ? '…' : displayName}</Text>
            {isTeacher && user?.teacherNo ? (
              <Text className={styles.teacherNoTag}>编号 {user.teacherNo}</Text>
            ) : null}
          </View>
          <Text className={styles.desc}>{desc}</Text>
        </View>
      </View>

      {isTeacher ? (
        <View className={styles.group}>
          <View className={styles.menuItem} onClick={() => go('/pages/resume/index')}>
            <Text className={styles.menuLabel}>简历管理</Text>
            <Text className={styles.menuArrow}>›</Text>
          </View>
          <View className={styles.menuItem} onClick={() => go('/pages/verify/index')}>
            <Text className={styles.menuLabel}>实名 + 学籍认证</Text>
            <View className={styles.menuRight}>
              <Text className={styles.menuHint}>去认证</Text>
              <Text className={styles.menuArrow}>›</Text>
            </View>
          </View>
          <View className={styles.menuItem} onClick={() => go('/pages/contact/index')}>
            <Text className={styles.menuLabel}>个人信息</Text>
            <Text className={styles.menuArrow}>›</Text>
          </View>
          <View className={styles.menuItem} onClick={() => go('/pages/notifications/index')}>
            <Text className={styles.menuLabel}>消息通知</Text>
            <View className={styles.menuRight}>
              {unread > 0 ? <Text className={styles.menuHint}>{unread} 条未读</Text> : null}
              <Text className={styles.menuArrow}>›</Text>
            </View>
          </View>
        </View>
      ) : (
        <View className={styles.group}>
          <View className={styles.menuItem} onClick={() => go('/pages/contact/index')}>
            <Text className={styles.menuLabel}>个人信息</Text>
            <View className={styles.menuRight}>
              {!rawNick ? <Text className={styles.menuHint}>待完善</Text> : null}
              <Text className={styles.menuArrow}>›</Text>
            </View>
          </View>
          <View className={styles.menuItem} onClick={() => go('/pages/notifications/index')}>
            <Text className={styles.menuLabel}>消息通知</Text>
            <View className={styles.menuRight}>
              {unread > 0 ? <Text className={styles.menuHint}>{unread} 条未读</Text> : null}
              <Text className={styles.menuArrow}>›</Text>
            </View>
          </View>
        </View>
      )}

      <View className={styles.group}>
        <View className={styles.menuItem} onClick={() => go('/pages/agreement/index')}>
          <Text className={styles.menuLabel}>用户服务协议</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={() => go('/pages/privacy/index')}>
          <Text className={styles.menuLabel}>隐私与风险说明</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
        <View className={styles.menuItem} onClick={switchIdentity}>
          <Text className={styles.menuLabel}>{isTeacher ? '切换身份（我有需求）' : '切换身份（我来接单）'}</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>
    </View>
  )
}
