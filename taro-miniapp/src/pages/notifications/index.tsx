import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@/store/user'
import { callFunction } from '@/services/cloud'
import NavBar from '@/components/NavBar'
import { getRoleEvents, requestSubscribe } from '@/services/subscribe'
import type { SubscribeEventDef } from '@/constants/subscribe'
import styles from './index.module.scss'

interface Notice {
  t: string
  d: string
  time: string
  unread: boolean
}

const PARENT_NOTICES: Notice[] = [
  { t: '有人报名', d: '你的需求已有老师报名，代理人正在核验，请留意后续推荐', time: '10 分钟前', unread: true },
  { t: '已推荐人选', d: '平台已为你推荐合适老师，请进入「我的需求」确认人选', time: '2 小时前', unread: true },
  { t: '需求发布成功', d: '你的需求已上架，符合条件的老师会陆续报名', time: '昨天', unread: true },
]

const TEACHER_NOTICES: Notice[] = [
  { t: '报名被推荐', d: '你的报名已被代理人推荐给家长，请留意电话', time: '10 分钟前', unread: true },
  { t: '家长确认成交', d: '家长已确认你为「初三 · 数学」老师，代理人将尽快联系你', time: '2 小时前', unread: true },
  { t: '新需求上架', d: '新增 6 条符合你条件的需求，快去广场看看吧', time: '昨天', unread: true },
]

export default function NotificationsPage() {
  const { role, setUnread } = useUser()
  const isTeacher = role === 'teacher'
  const [list, setList] = useState<Notice[]>(isTeacher ? TEACHER_NOTICES : PARENT_NOTICES)
  // 系统通知（订阅）授权绑定：哪些事件已开启
  const [boundEvents, setBoundEvents] = useState<string[]>([])
  const [busy, setBusy] = useState<string>('')

  const unreadCount = list.filter((n) => n.unread).length
  const roleKey = (isTeacher ? 'teacher' : 'parent') as 'teacher' | 'parent'
  const guide = isTeacher
    ? '重要节点通过微信订阅消息触达，站内信仅作记录备份。开启订阅后，新需求、报名被推荐、家长确认成交等都会及时提醒你。'
    : '重要节点通过微信订阅消息触达，站内信仅作记录备份。开启订阅后，有人报名、已推荐人选、需求发布成功等都会及时提醒你。'

  // 读取云端授权绑定（本人当前身份的 notifyPrefs，随 parent/teacher 分表）
  const loadBindings = useCallback(() => {
    if (process.env.TARO_ENV !== 'weapp') return
    callFunction<{ events: string[] }>('notifyPref', { action: 'get', role: roleKey })
      .then((res) => {
        if (res && Array.isArray(res.events)) setBoundEvents(res.events)
      })
      .catch((err) => console.warn('[Notify] 读取订阅状态失败', err))
  }, [roleKey])

  useEffect(() => {
    loadBindings()
  }, [loadBindings])

  const persist = async (next: string[]) => {
    setBoundEvents(next)
    if (process.env.TARO_ENV !== 'weapp') return
    try {
      await callFunction('notifyPref', { action: 'set', role: roleKey, events: next })
    } catch (err) {
      console.warn('[Notify] 保存订阅状态失败', err)
    }
  }

  // 开启某个事件的系统通知：先申请订阅权限，再记录授权绑定
  const enable = async (ev: SubscribeEventDef) => {
    setBusy(ev.key)
    try {
      if (!ev.tmplId) {
        Taro.showToast({
          title: '开发者在微信后台配置该事件模板 ID 前暂不可用',
          icon: 'none',
        })
        return
      }
      const res = await requestSubscribe([ev.tmplId])
      const state = res[ev.tmplId]
      if (state === 'accept') {
        await persist([...new Set([...boundEvents, ev.key])])
        Taro.showToast({ title: `已开启「${ev.title}」提醒`, icon: 'success' })
      } else {
        Taro.showToast({
          title: state === 'ban' ? '已被系统限制，请稍后重试' : '未允许本次订阅，通知未开启',
          icon: 'none',
        })
      }
    } catch (err) {
      Taro.showToast({ title: '开启失败，请重试', icon: 'none' })
    } finally {
      setBusy('')
    }
  }

  // 关闭某个事件（一次性订阅授权已用尽后也可手动关闭意图）
  const disable = async (key: string) => {
    await persist(boundEvents.filter((k) => k !== key))
    Taro.showToast({ title: '已关闭提醒', icon: 'none' })
  }

  // 已授权事件：发送一条测试推送（需模板 ID 已配置，便于联调推送链路）
  const sendTest = async (key: string) => {
    if (process.env.TARO_ENV !== 'weapp') {
      Taro.showToast({ title: '请在微信小程序中测试推送', icon: 'none' })
      return
    }
    setBusy(`test_${key}`)
    try {
      const res = await callFunction<{ ok: boolean; reason: string }>('notifyPref', {
        action: 'sendTest',
        role: roleKey,
        eventKey: key,
      })
      Taro.showModal({
        title: '测试推送结果',
        content: res && res.ok ? (res.reason || '已发送') : (res && res.reason) || '发送失败，请检查模板配置',
        showCancel: false,
      })
    } catch (err) {
      Taro.showToast({ title: '调用失败，请重试', icon: 'none' })
    } finally {
      setBusy('')
    }
  }

  const markRead = (index: number) => {
    const next = list.map((n, i) => (i === index ? { ...n, unread: false } : n))
    setList(next)
    setUnread(next.filter((n) => n.unread).length)
  }

  const markAllRead = () => {
    const next = list.map((n) => ({ ...n, unread: false }))
    setList(next)
    setUnread(0)
  }

  const events = getRoleEvents(roleKey)

  return (
    <View className={styles.page}>
      <NavBar title="消息通知" onBack={() => Taro.navigateBack()} />

      <View className={styles.guideCard}>
        <Text className={styles.guide}>{guide}</Text>
        <View className={styles.countRow}>
          <Text className={styles.unreadCount}>{unreadCount} 条未读</Text>
          {unreadCount > 0 ? (
            <Text className={styles.markAll} onClick={markAllRead}>
              全部已读
            </Text>
          ) : null}
        </View>
      </View>

      {/* 系统通知：订阅消息授权管理 */}
      <View className={styles.subCard}>
        <Text className={styles.subTitle}>系统通知 · 微信订阅提醒</Text>
        <Text className={styles.subDesc}>点击「开启」，微信会弹出订阅授权，允许后相关节点即可向您推送提醒。</Text>
        {events.map((ev) => {
          const on = boundEvents.includes(ev.key)
          return (
            <View key={ev.key} className={styles.subRow}>
              <View className={styles.subInfo}>
                <Text className={styles.subName}>{ev.title}</Text>
                <Text className={styles.subHint}>{ev.desc}</Text>
              </View>
              {on ? (
                <View className={styles.subOnGroup}>
                  <Text className={styles.subOnBtn} onClick={() => disable(ev.key)}>
                    已开启
                  </Text>
                  <Text className={styles.subTestBtn} onClick={() => sendTest(ev.key)}>
                    {busy === `test_${ev.key}` ? '发送中' : '发送测试'}
                  </Text>
                </View>
              ) : (
                <Text className={styles.subOffBtn} onClick={() => enable(ev)}>
                  {busy === ev.key ? '申请中…' : '开启'}
                </Text>
              )}
            </View>
          )
        })}
        {events.length === 0 ? <Text className={styles.subHint}>暂无可配置的提醒事件</Text> : null}
      </View>

      {list.map((n, i) => (
        <View
          key={i}
          className={classnames(styles.item, !n.unread && styles.itemRead)}
          onClick={() => markRead(i)}
        >
          <View className={styles.itemHead}>
            <View className={classnames(styles.dot, n.unread && styles.dotUnread)} />
            <View className={styles.itemBody}>
              <Text className={styles.title}>{n.t}</Text>
              <Text className={styles.desc}>{n.d}</Text>
              <Text className={styles.time}>{n.time}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}
