import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { ensureWechatPrivacy } from '@/services/privacy'
import PrimaryButton from '@/components/PrimaryButton'
import GhostButton from '@/components/GhostButton'
import styles from './index.module.scss'

const CONSENT_KEY = 'privacy_consent_v1'
const POLICY_VERSION = '2026-09'

/**
 * 首次启动的隐私协议门（仅微信小程序）：
 * 在收集任何个人信息/调用隐私接口前，先征得用户同意《用户信息采集与隐私保护声明》。
 * 同意 → 本地记录 + 同步微信官方隐私授权（wx.requirePrivacyAuthorize）；
 * 不同意 → 引导退出小程序（不收集任何信息，符合微信审核要求）。
 * 老用户（已同意过）静默放行，并继续触发官方授权同步。
 */
export default function PrivacyGate() {
  const [needAgree, setNeedAgree] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (process.env.TARO_ENV !== 'weapp') {
      setChecked(true)
      return
    }
    try {
      const agreed = Taro.getStorageSync(CONSENT_KEY) === '1'
      if (agreed) {
        // 已同意的老用户：直接进入，并把官方隐私授权也同步一次
        ensureWechatPrivacy()
        setChecked(true)
      } else {
        setNeedAgree(true)
        setChecked(true)
      }
    } catch {
      // 存储不可用时按“需同意”处理
      setNeedAgree(true)
      setChecked(true)
    }
  }, [])

  const agree = () => {
    try {
      Taro.setStorageSync(CONSENT_KEY, '1')
    } catch {
      /* 忽略存储异常，仍按同意放行 */
    }
    setNeedAgree(false)
    // 同步微信官方隐私授权弹窗（首次会拉起官方《用户隐私保护指引》）
    ensureWechatPrivacy()
  }

  const reject = () => {
    Taro.showModal({
      title: '需要您的同意',
      content: '不同意将无法使用需要收集信息的服务。是否退出小程序？（您可以在下次打开时重新阅读并同意）',
      confirmText: '退出',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          try {
            Taro.exitMiniProgram()
          } catch (e) {
            console.warn('[PrivacyGate] exitMiniProgram 失败', e)
          }
        }
      },
    })
  }

  const openPolicy = () => {
    Taro.navigateTo({ url: '/pages/privacy/index' })
  }

  // 非微信端或无需弹窗时，不渲染
  if (!checked || !needAgree) return null

  return (
    <View className={styles.mask}>
      <View className={styles.card}>
        <Text className={styles.title}>隐私保护提示</Text>
        <Text className={styles.desc}>
          「小小陪伴帮」尊重并保护您的个人信息。我们仅收集提供服务所必需的信息，联系电话为选填项，不会强制索取；
          您的信息仅用于平台代理人与您对接，不会公开展示。
        </Text>
        <View className={styles.link} onClick={openPolicy}>
          <Text className={styles.linkText}>查看《用户信息采集与隐私保护声明》 ›</Text>
        </View>
        <View className={styles.actions}>
          <GhostButton onClick={reject}>不同意</GhostButton>
          <PrimaryButton onClick={agree}>同意并继续</PrimaryButton>
        </View>
        <Text className={styles.version}>版本：{POLICY_VERSION}（后续更新将在小程序内重新公示）</Text>
      </View>
    </View>
  )
}
