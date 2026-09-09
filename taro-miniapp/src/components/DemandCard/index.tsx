import { View, Text } from '@tarojs/components'
import type { Demand } from '@/types'
import StatusTag from '@/components/StatusTag'
import styles from './index.module.scss'

interface DemandCardProps {
  demand: Demand
  onClick?: () => void
}

export default function DemandCard({ demand, onClick }: DemandCardProps) {
  return (
    <View className={styles.card} onClick={onClick}>
      <View className={styles.cardHead}>
        <View className={styles.subjectBox}>
          <Text className={styles.subjectText}>{demand.subject}</Text>
        </View>
        <View className={styles.cardInfo}>
          <View className={styles.titleRow}>
            <Text className={styles.title}>
              {demand.grade} · {demand.subject}
            </Text>
            <StatusTag status={demand.status} />
          </View>
          <Text className={styles.desc}>
            {demand.title} · {demand.time}
          </Text>
          <Text className={styles.desc}>
            {demand.area} · {demand.gender === '不限' ? '性别不限' : `偏好${demand.gender}老师`}
          </Text>
          <View className={styles.cardFoot}>
            <Text className={styles.budget}>{demand.budget}</Text>
            <Text className={styles.applicants}>已有 {demand.applicants} 位老师报名</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
