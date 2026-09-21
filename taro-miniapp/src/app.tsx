import React, { useEffect } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { UserProvider } from './store/user'
import PrivacyGate from './components/PrivacyGate'
import { CLOUD_ENV_ID } from './config/env'
// 全局样式
import './app.scss'
// 管理后台全局样式（adm-* 通用类）
import './styles/admin.scss'

function App(props) {
  // 云开发初始化（仅微信小程序）
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      if (!CLOUD_ENV_ID) {
        console.error(
          '[云开发] 未配置云环境 ID。请在 taro-miniapp/.env 中设置 TARO_APP_CLOUD_ENV_ID（可复制 .env.example）',
        )
        return
      }
      Taro.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
      // 隐私授权由 PrivacyGate 统一管理：
      // 首次启动先弹自定义隐私协议门，用户同意后再同步微信官方隐私授权（wx.requirePrivacyAuthorize）
    }
  }, [])

  // 对应 onShow
  useDidShow(() => {})

  // 对应 onHide
  useDidHide(() => {})

  return (
    <UserProvider>
      {props.children}
      <PrivacyGate />
    </UserProvider>
  )
}

export default App
