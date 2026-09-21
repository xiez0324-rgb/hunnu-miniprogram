import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface PlatformRecordNoticeProps {
  /** 针对不同页面的补充说明（默认按「平台统一录入后发布」表述） */
  desc?: string
}

/**
 * 信息录入合规提示（家长端 / 老师端所有信息填写页面统一使用）
 * 明确平台为信息的唯一收集者与发布者，用户不直接对外发布任何内容。
 */
export default function PlatformRecordNotice({ desc }: PlatformRecordNoticeProps) {
  return (
    <View className={styles.notice}>
      <Text className={styles.title}>信息由平台统一录入与发布</Text>
      <Text className={styles.main}>您无权直接发布信息，仅由平台工作人员录入信息后统一发布。</Text>
      <Text className={styles.desc}>
        {desc || '我们收集您填写的信息，由平台统一录入、核验后发布；信息仅用于为您匹配与对接服务，不会公开展示您的联系方式。'}
      </Text>
    </View>
  )
}
