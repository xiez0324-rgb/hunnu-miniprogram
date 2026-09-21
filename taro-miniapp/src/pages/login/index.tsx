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
  // 协议同意：必须由用户手动勾选，默认不勾选（不得默认强制同意）
  const [agreed, setAgreed] = useState(false)

  const handleLogin = async () => {
    if (loading) return
    if (!agreed) {
      Taro.showToast({ title: '请先阅读并勾选同意《用户服务协议》和《隐私与风险说明》', icon: 'none' })
      return
    }
    setLoading(true)
    try {
      // 静默登录：仅换取微信 openid 建立会话，不收集任何个人信息
      // 昵称由云端按角色兜底（老师未命名前统一为「同学」），前端不写死演示名
      let code = ''
      if (process.env.TARO_ENV === 'weapp') {
        const res = await Taro.login()
        code = res.code || ''
      }
      await login('teacher', undefined, code)
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
          {loading ? '进入中…' : '进入小程序'}
        </PrimaryButton>
        <View className={styles.agreeRow} onClick={() => setAgreed(!agreed)}>
          <View className={classnames(styles.checkbox, agreed && styles.checkboxChecked)}>
            {agreed ? <Text className={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text className={styles.agreementText}>
            我已阅读并同意
            <Text
              className={styles.link}
              onClick={(e) => {
                e.stopPropagation()
                Taro.navigateTo({ url: '/pages/agreement/index' })
              }}
            >
              《用户服务协议》
            </Text>
            和
            <Text
              className={styles.link}
              onClick={(e) => {
                e.stopPropagation()
                Taro.navigateTo({ url: '/pages/privacy/index' })
              }}
            >
              《隐私与风险说明》
            </Text>
          </Text>
        </View>

        <View className={styles.adminEntry} onClick={() => Taro.navigateTo({ url: '/pages/admin/login/index' })}>
          <Text className={styles.adminEntryText}>管理后台入口（仅限管理员）</Text>
        </View>
      </View>
    </View>
  )
}
