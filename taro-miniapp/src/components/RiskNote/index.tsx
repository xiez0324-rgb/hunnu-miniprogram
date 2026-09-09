import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

export default function RiskNote({ children }: { children: React.ReactNode }) {
  return (
    <View className={styles.note}>
      <Text className={styles.icon}>!</Text>
      <Text className={styles.text}>{children}</Text>
    </View>
  )
}
