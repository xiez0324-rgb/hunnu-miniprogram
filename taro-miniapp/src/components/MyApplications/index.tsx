import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { callFunction } from '@/services/cloud'
import type { Application } from '@/types'
import Chip from '@/components/Chip'
import StatusTag from '@/components/StatusTag'
import EmptyState from '@/components/EmptyState'
import GhostButton from '@/components/GhostButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import styles from './index.module.scss'

const chips = ['全部', '已报名', '已推荐', '已确认', '已成交']

export default function MyApplications() {
  const [filter, setFilter] = useState('全部')
  const [list, setList] = useState<Application[]>([])
  const [cancelled, setCancelled] = useState<string[]>([])
  const [pendingCancel, setPendingCancel] = useState<string | null>(null)

  const fetchList = useCallback(() => {
    callFunction<{ list: Application[] }>('getMyData', { role: 'teacher', status: filter }).then(
      (res) => setList(res.list as Application[]),
    ).catch((err) => {
      console.error('[MyApplications] 获取报名失败', err)
    })
  }, [filter])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 页面每次从其它页切回（tab 切换 / 返回）都刷新，保证报名/取消后「进度」页数据是最新。
  // 首次进入由上方 useEffect 拉取，这里跳过首次避免重复请求。
  const shownOnce = useRef(false)
  useDidShow(() => {
    if (!shownOnce.current) {
      shownOnce.current = true
      return
    }
    fetchList()
  })

  const confirmCancel = async () => {
    if (!pendingCancel) return
    const id = pendingCancel
    setPendingCancel(null)
    try {
      await callFunction('cancelApplication', { applicationId: id })
      setCancelled((prev) => [...prev, id])
      // 非「全部」分组下服务端状态已变更，本地同步移除，避免出现「已取消」记录滞留在原分组
      setList((prev) => (filter === '全部' ? prev : prev.filter((x) => x.id !== id)))
      Taro.showToast({ title: '已取消报名', icon: 'success' })
    } catch (err) {
      console.error('[MyApplications] 取消报名失败', err)
      Taro.showToast({ title: (err as Error)?.message || '取消失败，请重试', icon: 'none' })
    }
  }

  const openDetail = (demandId?: string) => {
    if (demandId) {
      Taro.navigateTo({ url: `/pages/demand-detail/index?id=${demandId}` })
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>我的报名</Text>
      </View>

      <ScrollView scrollX className={styles.chipsWrap}>
        <View className={styles.chips}>
          {chips.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {c}
            </Chip>
          ))}
        </View>
      </ScrollView>

      {list.length === 0 ? (
        <EmptyState icon="📭" title="还没有该状态的报名" />
      ) : (
        list.map((a) => {
          const isCancelled = cancelled.includes(a.id)
          const cancellable = !isCancelled && (a.status === '已报名' || a.status === '已推荐')
          return (
            <View key={a.id} className={styles.card} onClick={() => openDetail(a.demandId)}>
              <View className={styles.cardHead}>
                <Text className={styles.cardTitle}>{a.title}</Text>
                <StatusTag status={isCancelled ? '已取消' : a.status} />
              </View>
              <Text className={styles.cardMeta}>
                {a.budget} · {a.meta}
              </Text>
              {cancellable ? (
                <View className={styles.cardFoot}>
                  <GhostButton
                    onClick={(e) => {
                      e?.stopPropagation()
                      setPendingCancel(a.id)
                    }}
                  >
                    取消报名
                  </GhostButton>
                </View>
              ) : null}
            </View>
          )
        })
      )}

      <View className={styles.tipCard}>
        <Text className={styles.tipText}>
          每次报名与取消的完整记录（时间、需求、去向）都会留存后台，供平台检测异常操作；请勿频繁取消，以免被判定为恶意占单。同时报名中的需求不超过 5 个，达到上限后将无法继续报名。
        </Text>
      </View>

      <ConfirmDialog
        visible={pendingCancel !== null}
        title="确认取消报名？"
        content="取消后将退出该需求单的报名，此操作会被后台留痕记录。确定要取消吗？"
        confirmText="确认取消"
        onCancel={() => setPendingCancel(null)}
        onConfirm={confirmCancel}
      />
    </View>
  )
}
