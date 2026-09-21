import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { callAdmin, getAdminUser, guardAdminPage, invalidateAdminCache, logoutAdmin } from '@/services/admin'
import type { DashData } from '@/types/admin'
import styles from './index.module.scss'

interface StatCard {
  key: string
  label: string
  value: number
  hint?: string
  url: string
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const user = getAdminUser()

  const load = useCallback((force = false) => {
    if (force) invalidateAdminCache('adminDashboard')
    setLoading(true)
    setError('')
    callAdmin<DashData>('adminDashboard')
      .then((d) => setData(d))
      .catch((err) => {
        console.error('[AdminDashboard] 加载失败', err)
        setError((err as Error).message)
      })
      .finally(() => {
        setLoading(false)
        Taro.stopPullDownRefresh()
      })
  }, [])

  useEffect(() => {
    if (!guardAdminPage()) return
    load()
  }, [load])

  usePullDownRefresh(() => {
    load(true)
  })

  const go = (url: string) => {
    Taro.navigateTo({ url })
  }

  const goOrders = (status: string) => {
    go(`/pages/admin/orders/index?status=${encodeURIComponent(status)}`)
  }

  const goDemands = (status: string) => {
    go(status === '全部' ? '/pages/admin/demands/index' : `/pages/admin/demands/index?status=${encodeURIComponent(status)}`)
  }

  const confirmLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '退出后需重新输入账号密码才能进入后台，确认退出吗？',
      confirmText: '退出',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          logoutAdmin()
        }
      },
    })
  }

  const cards: StatCard[] = [
    { key: 'demands-total', label: '全部需求单', value: data?.demands ?? 0, hint: '点击查看需求单明细', url: '/pages/admin/demands/index' },
    { key: 'demands-active', label: '进行中需求', value: data?.activeDemands ?? 0, url: '/pages/admin/demands/index?status=%E8%BF%9B%E8%A1%8C%E4%B8%AD' },
    { key: 'demands-audit', label: '待审核需求', value: data?.demandAuditPending ?? 0, hint: '点击进入需求审核', url: '/pages/admin/demands/index?audit=%E5%BE%85%E5%AE%A1%E6%A0%B8' },
    { key: 'applications', label: '老师报名', value: data?.applications ?? 0, hint: '点击查看报名明细', url: '/pages/admin/applications/index' },
    { key: 'orders-待联系', label: '待联系订单', value: data?.matches?.['待联系'] ?? 0, hint: '家长已确认，待平台跟进', url: '/pages/admin/orders/index' },
    { key: 'orders-已联系', label: '已联系', value: data?.matches?.['已联系'] ?? 0, url: '/pages/admin/orders/index' },
    { key: 'orders-已成交', label: '已成交', value: data?.matches?.['已成交'] ?? 0, url: '/pages/admin/orders/index' },
    { key: 'orders-已取消', label: '已取消', value: data?.matches?.['已取消'] ?? 0, url: '/pages/admin/orders/index' },
    { key: 'orders-已撤回', label: '已撤回', value: data?.matches?.['已撤回'] ?? 0, hint: '订单撤回后需求整单下架', url: '/pages/admin/orders/index' },
    { key: 'verify', label: '待审核认证', value: data?.verifications?.['待审核'] ?? 0, hint: '点击进入学籍审核', url: '/pages/admin/verifications/index' },
    { key: 'deliveries', label: '待处理咨询', value: data?.inquiries?.['待处理'] ?? 0, hint: '点击查看投递与推荐', url: '/pages/admin/deliveries/index' },
    { key: 'fee', label: '信息费待收', value: data?.fee?.['待付'] ?? 0, hint: `待收 ${data?.fee?.['待付金额'] ?? 0} 元`, url: '/pages/admin/fees/index' },
  ]

  const handleTap = (c: StatCard) => {
    if (c.key.startsWith('orders-')) {
      const status = c.key.replace('orders-', '')
      goOrders(status)
      return
    }
    if (c.key === 'demands-total') {
      go(c.url)
      return
    }
    if (c.key === 'demands-active') {
      goDemands('进行中')
      return
    }
    go(c.url)
  }

  return (
    <View className="admPage">
      <View className={styles.headerCard}>
        <View className={styles.headerLeft}>
          <Text className={styles.headerTitle}>平台管理控制台</Text>
          <Text className={styles.headerSub}>
            账号：{user.username || '—'}（{user.level || 'admin'}）· 在线老师 {data?.users?.teacher ?? 0} 人 · 注册家长 {data?.users?.parent ?? 0} 人
          </Text>
        </View>
        <View className={styles.headerActions}>
          <View className={styles.iconBtn} onClick={() => go('/pages/admin/query/index')}>
            <Text>订单检索</Text>
          </View>
          <View className={styles.iconBtn} onClick={() => go('/pages/admin/settings/index')}>
            <Text>设置</Text>
          </View>
          <View className={styles.iconBtn} onClick={confirmLogout}>
            <Text>退出</Text>
          </View>
        </View>
      </View>

      {error ? <Text className="admErrorText">{error}</Text> : null}
      {loading && !data ? <View className="admLoadingBlock">数据加载中…</View> : null}

      <View className="admHeaderRow">
        <Text className="admHint">点击数据卡进入对应明细</Text>
        <View
          className="admTextBtn"
          onClick={() => {
            load(true)
          }}
        >
          <Text>刷新数据</Text>
        </View>
      </View>

      <View className={styles.statGrid}>
        {cards.map((c) => (
          <View key={c.key} className={styles.statCard} onClick={() => handleTap(c)}>
            <Text className={styles.statLabel}>{c.label}</Text>
            <Text className={styles.statValue}>{c.value}</Text>
            {c.hint ? <Text className={styles.statHint}>{c.hint}</Text> : <Text className={styles.statHint}>点击查看明细 →</Text>}
          </View>
        ))}
      </View>

      <Text className={styles.footerNote}>管理功能仅限平台授权人员使用；业务数据实时来自云端，请勿外传。</Text>
    </View>
  )
}
