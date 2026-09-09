import { View } from '@tarojs/components'
import classnames from 'classnames'
import { useUser } from '@/store/user'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import MyApplications from '@/components/MyApplications'
import MyDemands from '@/components/MyDemands'
import styles from './index.module.scss'

export default function ProgressPage() {
  useRequireLogin()
  const { role } = useUser()
  return (
    <View className={styles.page}>
      <View className={classnames(styles.deco, styles.decoA)} />
      {role === 'teacher' ? <MyApplications /> : <MyDemands />}
    </View>
  )
}
