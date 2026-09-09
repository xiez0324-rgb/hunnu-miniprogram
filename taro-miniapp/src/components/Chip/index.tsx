import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

interface ChipProps {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}

export default function Chip({ children, active, onClick }: ChipProps) {
  return (
    <View
      className={classnames(styles.chip, active && styles.chipActive)}
      onClick={onClick}
    >
      <Text className={styles.chipText}>{children}</Text>
    </View>
  )
}
