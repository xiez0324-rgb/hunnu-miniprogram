import { View } from '@tarojs/components'
import classnames from 'classnames'
import { useUser } from '@/store/user'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import Plaza from '@/components/Plaza'
import Publish from '@/components/Publish'
import styles from './index.module.scss'

export default function HomePage() {
  useRequireLogin()
  const { role } = useUser()
  return (
    <View className={styles.page}>
      <View className={classnames(styles.deco, styles.decoA)} />
      <View className={classnames(styles.deco, styles.decoB)} />
      {role === 'teacher' ? <Plaza /> : <Publish />}
    </View>
  )
}
