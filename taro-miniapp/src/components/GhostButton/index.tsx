import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

interface GhostButtonProps {
  children: React.ReactNode
  onClick?: (e?: any) => void
  disabled?: boolean
  className?: string
}

export default function GhostButton({
  children,
  onClick,
  disabled,
  className,
}: GhostButtonProps) {
  return (
    <View
      className={classnames(styles.button, disabled && styles.buttonDisabled, className)}
      onClick={disabled ? undefined : onClick}
    >
      <Text className={styles.buttonText}>{children}</Text>
    </View>
  )
}
