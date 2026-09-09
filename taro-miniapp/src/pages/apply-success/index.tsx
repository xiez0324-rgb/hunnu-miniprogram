import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { callFunction } from '@/services/cloud'
import PrimaryButton from '@/components/PrimaryButton'
import GhostButton from '@/components/GhostButton'
import { requestSubscribe } from '@/services/subscribe'
import { SUBSCRIBE_CONFIG } from '@/constants/subscribe'
import styles from './index.module.scss'

export default function ApplySuccessPage() {
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  // 报名成功：向老师申请「报名被推荐」「家长确认成交」的订阅授权
  const enableNotify = async () => {
    if (process.env.TARO_ENV !== 'weapp') {
      setSubscribed(true)
      return
    }
    setBusy(true)
    const teacherEvents = SUBSCRIBE_CONFIG.teacher.filter((e) => e.tmplId)
    const ids = teacherEvents.map((e) => e.tmplId)
    if (ids.length === 0) {
      Taro.showToast({ title: '开发者尚未配置订阅模板，先以站内信提醒', icon: 'none' })
      setSubscribed(true)
      setBusy(false)
      return
    }
    const res = await requestSubscribe(ids)
    const accepted = teacherEvents.filter((e) => res[e.tmplId] === 'accept').map((e) => e.key)
    if (accepted.length > 0) {
      try {
        await callFunction('notifyPref', { action: 'set', role: 'teacher', events: accepted })
      } catch (err) {
        console.warn('[ApplySuccess] 保存订阅失败', err)
      }
    }
    setSubscribed(true)
    setBusy(false)
    Taro.showToast({
      title: accepted.length > 0 ? '已开启，重要节点将微信提醒' : '未授权订阅，将仅站内信提醒',
      icon: 'none',
    })
  }

  return (
    <View className={styles.page}>
      <Text className={styles.icon}>✅</Text>
      <Text className={styles.title}>报名成功！</Text>
      <Text className={styles.desc}>代理人会尽快核验并推荐给家长，请保持通知开启</Text>

      <View className={styles.card}>
        <PrimaryButton onClick={enableNotify} disabled={subscribed || busy}>
          {busy ? '授权处理中…' : subscribed ? '通知已开启' : '开启通知（订阅）'}
        </PrimaryButton>
        <View className={styles.secondary}>
          <GhostButton onClick={() => Taro.switchTab({ url: '/pages/progress/index' })}>
            查看我的报名
          </GhostButton>
        </View>
      </View>
    </View>
  )
}
