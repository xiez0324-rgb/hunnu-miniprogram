import { View, Text, Image } from '@tarojs/components'
import classnames from 'classnames'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useUser } from '@/store/user'
import PrimaryButton from '@/components/PrimaryButton'
import appIcon from '@/assets/app-icon.png'
import styles from './index.module.scss'

export default function LoginPage() {
  const { login } = useUser()
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (loading) return
    setLoading(true)
    try {
      // 微信一键登录（静默）：小程序端先拿 code 走真实登录链路；云函数自动解析 openid
      let code = ''
      if (process.env.TARO_ENV === 'weapp') {
        const res = await Taro.login()
        code = res.code || ''
      }
      await login('teacher', '张同学', code)
      Taro.redirectTo({ url: '/pages/role-select/index' })
    } catch (err) {
      console.error('[Login] 微信登录失败', err)
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className={styles.page}>
      <View className={classnames(styles.deco, styles.decoA)} />
      <View className={classnames(styles.deco, styles.decoB)} />
      <View className={classnames(styles.deco, styles.decoC)} />

      <View className={styles.logoWrap}>
        <Image className={styles.logo} src={appIcon} mode="aspectFill" />
        <Text className={styles.title}>小小陪伴帮</Text>
      </View>

      <View className={styles.card}>
        <PrimaryButton onClick={handleLogin} disabled={loading}>
          {loading ? '登录中…' : '微信一键登录'}
        </PrimaryButton>
        <View className={styles.agreement}>
          <Text className={styles.agreementText}>
            登录即代表同意《用户协议》与
            <Text
              className={styles.link}
              onClick={() => Taro.navigateTo({ url: '/pages/privacy/index' })}
            >
              《隐私与风险说明》
            </Text>
          </Text>
        </View>
      </View>
    </View>
  )
}
