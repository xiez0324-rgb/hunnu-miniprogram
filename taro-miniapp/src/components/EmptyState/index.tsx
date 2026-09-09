import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface EmptyStateProps {
  icon: string
  title: string
  desc?: string
}

export default function EmptyState({ icon, title, desc }: EmptyStateProps) {
  return (
    <View className={styles.empty}>
      <Text className={styles.icon}>{icon}</Text>
      <Text className={styles.title}>{title}</Text>
      {desc ? <Text className={styles.desc}>{desc}</Text> : null}
    </View>
  )
}
