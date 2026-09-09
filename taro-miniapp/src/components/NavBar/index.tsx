import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

export default function NavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className={styles.navBar}>
      <View className={styles.backBtn} onClick={onBack}>
        <Text className={styles.backIcon}>‹</Text>
      </View>
      <Text className={styles.title}>{title}</Text>
      <View className={styles.backBtn} />
    </View>
  )
}
