import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

export default function VerifyTag({ verified }: { verified: boolean }) {
  return (
    <View
      className={classnames(styles.tag, verified ? styles.tagVerified : styles.tagUnverified)}
    >
      <Text className={styles.tagText}>{verified ? '已认证' : '未认证'}</Text>
    </View>
  )
}
