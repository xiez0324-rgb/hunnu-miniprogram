import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { callFunction } from '@/services/cloud'
import type { Demand } from '@/types'
import StatusTag from '@/components/StatusTag'
import PrimaryButton from '@/components/PrimaryButton'
import GhostButton from '@/components/GhostButton'
import EmptyState from '@/components/EmptyState'
import styles from './index.module.scss'

export default function MyDemands() {
  const [list, setList] = useState<Demand[]>([])

  const fetchList = useCallback(() => {
    callFunction<{ list: Demand[] }>('getMyData', { role: 'parent' }).then((res) => {
      setList(res.list as Demand[])
    }).catch((err) => {
      console.error('[MyDemands] 获取需求失败', err)
    })
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 页面每次切回都刷新：老师端报名/推荐后，家长「我的需求」的报名数保持最新
  const shownOnce = useRef(false)
  useDidShow(() => {
    if (!shownOnce.current) {
      shownOnce.current = true
      return
    }
    fetchList()
  })

  const openDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/parent-demand-detail/index?id=${id}` })
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>我的需求</Text>
      </View>

      {list.length === 0 ? (
        <EmptyState icon="📌" title="还没有发布需求" />
      ) : (
        list.map((d) => (
          <View key={d.id} className={styles.card}>
            <View className={styles.cardHead}>
              <Text className={styles.cardTitle}>
                {d.grade} · {d.subject} {d.title}
              </Text>
              <StatusTag status={d.status} />
            </View>
            <Text className={styles.cardMeta}>
              {d.applicants} 位老师报名 · {d.recommended} 位已推荐
            </Text>
            <View className={styles.cardFoot}>
              {d.recommended > 0 ? (
                <PrimaryButton onClick={() => openDetail(d.id)}>去确认人选</PrimaryButton>
              ) : (
                <GhostButton onClick={() => openDetail(d.id)}>查看报名进度</GhostButton>
              )}
            </View>
          </View>
        ))
      )}
    </View>
  )
}
