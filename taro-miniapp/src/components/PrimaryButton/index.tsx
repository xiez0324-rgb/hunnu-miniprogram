import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

interface PrimaryButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export default function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
}: PrimaryButtonProps) {
  return (
    <View
      className={classnames(
        styles.button,
        styles.buttonPrimary,
        disabled && styles.buttonDisabled,
        className,
      )}
      onClick={disabled ? undefined : onClick}
    >
      <Text className={styles.buttonText}>{children}</Text>
    </View>
  )
}
