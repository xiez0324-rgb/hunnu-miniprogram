import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import type { Applicant } from '@/types'
import VerifyTag from '@/components/VerifyTag'
import styles from './index.module.scss'

interface TeacherCardProps {
  applicant: Applicant
  index: number
  footer?: React.ReactNode
  onViewResume?: () => void
}

export default function TeacherCard({ applicant, index, footer, onViewResume }: TeacherCardProps) {
  const bgList = ['avatarA', 'avatarB']
  const bg = bgList[index % bgList.length] || 'avatarA'
  return (
    <View className={styles.card}>
      <View className={styles.cardBody}>
        <View className={styles.avatarWrap}>
          <View className={classnames(styles.avatarA, styles[bg])}>
            <Text className={styles.avatarText}>{applicant.name.slice(0, 1)}</Text>
          </View>
        </View>
        <View className={styles.cardInfo}>
          <View className={styles.titleRow}>
            <Text className={styles.name}>{applicant.name} 老师</Text>
            <VerifyTag verified={applicant.verified} />
            {applicant.recommended && <Text className={styles.recommendTag}>平台推荐</Text>}
          </View>
          <Text className={styles.meta}>
            {applicant.school} · {applicant.rate}
          </Text>
          <Text className={styles.meta}>
            {applicant.subject} · {applicant.meta}
          </Text>
          <Text className={styles.quote}>“{applicant.quote}”</Text>
        </View>
      </View>
      {onViewResume ? (
        <View className={styles.resumeEntry} onClick={onViewResume}>
          <Text className={styles.resumeEntryText}>查看完整简历 ›</Text>
        </View>
      ) : null}
      {footer ? <View className={styles.footer}>{footer}</View> : null}
    </View>
  )
}
