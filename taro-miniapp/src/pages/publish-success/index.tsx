import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { callFunction } from '@/services/cloud'
import PrimaryButton from '@/components/PrimaryButton'
import GhostButton from '@/components/GhostButton'
import { requestSubscribe } from '@/services/subscribe'
import { SUBSCRIBE_CONFIG } from '@/constants/subscribe'
import styles from './index.module.scss'

export default function PublishSuccessPage() {
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  // 发布成功：向家长申请「有人报名」「已推荐人选」的订阅授权
  const enableNotify = async () => {
    if (process.env.TARO_ENV !== 'weapp') {
      setSubscribed(true)
      return
    }
    setBusy(true)
    const parentEvents = SUBSCRIBE_CONFIG.parent.filter((e) => e.tmplId)
    const ids = parentEvents.map((e) => e.tmplId)
    if (ids.length === 0) {
      Taro.showToast({ title: '开发者尚未配置订阅模板，先以站内信提醒', icon: 'none' })
      setSubscribed(true)
      setBusy(false)
      return
    }
    const res = await requestSubscribe(ids)
    const accepted = parentEvents.filter((e) => res[e.tmplId] === 'accept').map((e) => e.key)
    if (accepted.length > 0) {
      try {
        await callFunction('notifyPref', { action: 'set', role: 'parent', events: accepted })
      } catch (err) {
        console.warn('[PublishSuccess] 保存订阅失败', err)
      }
    }
    setSubscribed(true)
    setBusy(false)
    Taro.showToast({
      title: accepted.length > 0 ? '已开启，有人报名将微信提醒' : '未授权订阅，将仅站内信提醒',
      icon: 'none',
    })
  }

  return (
    <View className={styles.page}>
      <Text className={styles.icon}>✅</Text>
      <Text className={styles.title}>需求发布成功！</Text>
      <Text className={styles.desc}>需求已上架，符合条件的老师会陆续报名</Text>

      <View className={styles.card}>
        <PrimaryButton onClick={enableNotify} disabled={subscribed || busy}>
          {busy ? '授权处理中…' : subscribed ? '通知已开启' : '开启通知（订阅）'}
        </PrimaryButton>
        <View className={styles.secondary}>
          <GhostButton onClick={() => Taro.switchTab({ url: '/pages/progress/index' })}>
            查看我的需求
          </GhostButton>
        </View>
      </View>
    </View>
  )
}
