import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import type { Application, Demand } from '@/types'
import NavBar from '@/components/NavBar'
import PrimaryButton from '@/components/PrimaryButton'
import VerifyTag from '@/components/VerifyTag'
import ConfirmDialog from '@/components/ConfirmDialog'
import styles from './index.module.scss'

export default function DemandDetailPage() {
  const router = useRouter()
  const [demand, setDemand] = useState<Demand | null>(null)
  const [applied, setApplied] = useState(false)
  const [asking, setAsking] = useState(false)

  // 报名上限：单老师同时「报名中」（已报名/已推荐）的需求不超过 limit 个，与云端 applyDemand 校验口径一致
  const limit = 5
  const [activeCount, setActiveCount] = useState(0)
  const [statsLoaded, setStatsLoaded] = useState(false)
  const limitFull = statsLoaded && activeCount >= limit

  useEffect(() => {
    const id = router.params.id || '1024'
    callFunction<{ demand: Demand }>('getDemandDetail', { demandId: id }).then((res) => {
      setDemand(res.demand)
    }).catch((err) => {
      console.error('[DemandDetail] 获取需求失败', err)
    })
    // 从云端统计当前老师「报名中数量」及是否已报本需求，替代写死的 activeCount/applied
    callFunction<{ list: Application[] }>('getMyData', { role: 'teacher', status: '全部' })
      .then((res) => {
        const list = res.list || []
        setActiveCount(list.filter((a) => a.status === '已报名' || a.status === '已推荐').length)
        setApplied(list.some((a) => a.demandId === id && a.status !== '已取消'))
        setStatsLoaded(true)
      })
      .catch((err) => {
        console.error('[DemandDetail] 获取报名统计失败', err)
        // 统计失败不阻塞按钮：后端 applyDemand 仍会做重复报名 / 5 条上限兜底拦截
        setStatsLoaded(true)
      })
  }, [router.params.id])

  const confirmApply = async () => {
    setAsking(false)
    if (!demand) return
    try {
      await callFunction('applyDemand', { demandId: demand.id })
      setApplied(true)
      Taro.redirectTo({ url: '/pages/apply-success/index' })
    } catch (err) {
      console.error('[DemandDetail] 报名失败', err)
      Taro.showToast({ title: (err as Error)?.message || '报名失败，请重试', icon: 'none' })
    }
  }

  // 需求不存在 / 未通过平台审核时，仅发布者可见，其他老师看到友好提示
  if (!demand) {
    return (
      <View className={styles.page}>
        <NavBar title="需求详情" onBack={() => Taro.navigateBack()} />
        <View className={styles.card}>
          <Text className={styles.rowValue}>该需求暂不可查看，可能正在平台审核中或已下架。</Text>
        </View>
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <NavBar title="需求详情" onBack={() => Taro.navigateBack()} />

      <View className={styles.card}>
        <View className={styles.headRow}>
          <VerifyTag verified />
          <Text className={styles.demandNo}>需求单 #{demand.id}</Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>年级/需求</Text>
          <Text className={styles.rowValue}>
            {demand.grade} · {demand.subject}
          </Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>需求类型</Text>
          <Text className={styles.rowValue}>{demand.goal}</Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>服务时段</Text>
          <Text className={styles.rowValue}>{demand.time}</Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>预算</Text>
          <Text className={styles.rowValue}>{demand.budget}</Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>偏好老师</Text>
          <Text className={styles.rowValue}>
            {demand.gender === '不限' ? '不限' : `${demand.gender}老师`}
          </Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>区域</Text>
          <Text className={styles.rowValue}>{demand.area}</Text>
        </View>
        {demand.note ? (
          <View className={styles.row}>
            <Text className={styles.rowLabel}>备注</Text>
            <Text className={styles.rowValue}>{demand.note}</Text>
          </View>
        ) : null}
      </View>

      <View className={styles.footer}>
        <PrimaryButton onClick={() => setAsking(true)} disabled={applied || limitFull}>
          {applied ? '已报名' : limitFull ? '报名已达上限' : '立即报名'}
        </PrimaryButton>
        <Text className={styles.footerTip}>
          报名中的需求 {activeCount} / {limit}
        </Text>
      </View>

      <ConfirmDialog
        visible={asking}
        title="确认报名？"
        content={`确认报名「${demand.grade} · ${demand.subject}」需求单？提交后平台工作人员将核验并推荐给家长。`}
        confirmText="确认报名"
        onCancel={() => setAsking(false)}
        onConfirm={confirmApply}
      />
    </View>
  )
}
