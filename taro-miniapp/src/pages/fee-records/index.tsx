import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { callFunction } from '@/services/cloud'
import type { FeeRecord } from '@/types'
import NavBar from '@/components/NavBar'
import StatusTag from '@/components/StatusTag'
import EmptyState from '@/components/EmptyState'
import styles from './index.module.scss'

export default function FeeRecordsPage() {
  const [list, setList] = useState<FeeRecord[]>([])

  const fetchList = useCallback(() => {
    callFunction<{ list: FeeRecord[] }>('getFeeRecords').then((res) => {
      setList(res.list)
    }).catch((err) => {
      console.error('[FeeRecords] 获取费用状态失败', err)
    })
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // 切回页面时刷新结清状态
  const shownOnce = useRef(false)
  useDidShow(() => {
    if (!shownOnce.current) {
      shownOnce.current = true
      return
    }
    fetchList()
  })

  return (
    <View className={styles.page}>
      <NavBar title="费用状态" onBack={() => Taro.navigateBack()} />

      <Text className={styles.note}>
        以下为存在信息费结算记录的订单。平台费用按线下阶梯方案收取，具体金额以代理人通知为准，此处仅展示订单结清状态。
      </Text>

      {list.length === 0 ? (
        <EmptyState icon="📋" title="暂无费用结算记录" />
      ) : (
        list.map((f) => (
          <View key={f.id} className={styles.card}>
            <View className={styles.head}>
              <Text className={styles.title}>{f.demand}</Text>
              <StatusTag status={f.status} />
            </View>
            <Text className={styles.tipText}>
              {f.status === '待付'
                ? '本订单信息费未结清，请留意平台代理人通知，按线下约定及时办理。'
                : '本订单信息费已结清。'}
            </Text>
          </View>
        ))
      )}
    </View>
  )
}
