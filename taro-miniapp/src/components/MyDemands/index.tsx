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
        <Text className={styles.title}>我的需求登记</Text>
      </View>

      {list.length === 0 ? (
        <EmptyState icon="📌" title="还没有登记需求" />
      ) : (
        list.map((d) => (
          <View key={d.id} className={styles.card}>
            <View className={styles.cardHead}>
              <Text className={styles.cardTitle}>
                {d.grade} · {d.subject} {d.title}
              </Text>
              {d.auditStatus === '待审核' ? <Text className={styles.auditTag}>平台审核中</Text> : null}
              {d.auditStatus === '已驳回' ? <Text className={styles.auditTagReject}>审核未通过</Text> : null}
              {d.confirmedTeacherName ? <Text className={styles.confirmTag}>已确认老师</Text> : null}
              <StatusTag status={d.status} />
            </View>
            <Text className={styles.cardMeta}>
              {d.auditStatus === '待审核'
                ? '平台工作人员正在录入核验，核验通过后由平台统一发布'
                : d.auditStatus === '已驳回'
                  ? d.rejectReason || '内容不符合平台录入规范，请修改后重新提交'
                  : d.confirmedTeacherName
                    ? `已确认老师：${d.confirmedTeacherName} · 共 ${d.applicants} 位老师报名`
                    : `${d.applicants} 位老师报名 · ${d.recommended} 位已推荐`}
            </Text>
            <View className={styles.cardFoot}>
              {d.confirmedTeacherName ? (
                <GhostButton onClick={() => openDetail(d.id)}>查看报名进度</GhostButton>
              ) : d.recommended > 0 ? (
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
