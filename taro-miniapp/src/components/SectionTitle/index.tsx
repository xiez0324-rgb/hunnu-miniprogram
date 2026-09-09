import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

interface SectionTitleProps {
  children: React.ReactNode
  primary?: boolean
  className?: string
}

export default function SectionTitle({ children, primary, className }: SectionTitleProps) {
  return (
    <Text
      className={classnames(styles.title, primary && styles.titlePrimary, className)}
    >
      {children}
    </Text>
  )
}
