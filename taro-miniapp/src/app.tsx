import React, { useEffect } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { UserProvider } from './store/user'
import { ensureWechatPrivacy } from './services/privacy'
// 全局样式
import './app.scss'

function App(props) {
  // 云开发初始化（仅微信小程序）
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      Taro.cloud.init({ env: '[环境 ID 见本地 .env]', traceUser: true })
      // 提审合规：启动即检查并拉起微信官方「隐私保护指引」弹窗
      ensureWechatPrivacy()
    }
  }, [])

  // 对应 onShow
  useDidShow(() => {})

  // 对应 onHide
  useDidHide(() => {})

  return <UserProvider>{props.children}</UserProvider>
}

export default App
