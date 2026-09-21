import { View } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import classnames from 'classnames'
import { useUser } from '@/store/user'
import { useRequireLogin } from '@/hooks/useRequireLogin'
import Plaza from '@/components/Plaza'
import Publish from '@/components/Publish'
import styles from './index.module.scss'

export default function HomePage() {
  useRequireLogin()
  const { role } = useUser()
  // 下拉刷新：老师端由 Plaza 内部拉取最新需求并收起动画；
  // 家长端是信息登记表单，无数据可刷，这里仅收起加载动画避免一直转圈。
  usePullDownRefresh(() => {
    if (role !== 'teacher') Taro.stopPullDownRefresh()
  })
  return (
    <View className={styles.page}>
      <View className={classnames(styles.deco, styles.decoA)} />
      <View className={classnames(styles.deco, styles.decoB)} />
      {role === 'teacher' ? <Plaza /> : <Publish />}
    </View>
  )
}
