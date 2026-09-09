import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

const tagStyles: Record<string, string> = {
  已报名: 'tagApplied',
  已推荐: 'tagRecommended',
  已确认: 'tagConfirmed',
  已成交: 'tagDealt',
  已取消: 'tagCancelled',
  进行中: 'tagApplied',
  待审核: 'tagPending',
  已驳回: 'tagPending',
  已下架: 'tagCancelled',
  待付: 'tagPending',
  已付: 'tagConfirmed',
}

export default function StatusTag({ status }: { status: string }) {
  const cls = tagStyles[status] || 'tagDefault'
  return (
    <View className={classnames(styles.tag, styles[cls])}>
      <Text className={styles.tagText}>{status}</Text>
    </View>
  )
}
