import { View, Text } from '@tarojs/components'
import PrimaryButton from '@/components/PrimaryButton'
import GhostButton from '@/components/GhostButton'
import styles from './index.module.scss'

interface ConfirmDialogProps {
  visible: boolean
  title: string
  content: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  visible,
  title,
  content,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!visible) return null

  return (
    <View className={styles.mask} onClick={onCancel}>
      <View className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <Text className={styles.title}>{title}</Text>
        <Text className={styles.content}>{content}</Text>
        <View className={styles.actions}>
          <View className={styles.btnWrap}>
            <GhostButton onClick={onCancel}>{cancelText}</GhostButton>
          </View>
          <View className={styles.btnWrap}>
            <PrimaryButton onClick={onConfirm}>{confirmText}</PrimaryButton>
          </View>
        </View>
      </View>
    </View>
  )
}
