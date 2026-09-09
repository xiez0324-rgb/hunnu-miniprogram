import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface FieldLabelProps {
  label: string
  children: React.ReactNode
  required?: boolean
  hint?: string
}

export default function FieldLabel({ label, children, required, hint }: FieldLabelProps) {
  return (
    <View className={styles.field}>
      <Text className={styles.label}>
        {required ? <Text className={styles.required}>* </Text> : null}
        {label}
      </Text>
      {hint ? <Text className={styles.hint}>{hint}</Text> : null}
      <View className={styles.content}>{children}</View>
    </View>
  )
}
