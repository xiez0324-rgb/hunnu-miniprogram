import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { callAdmin, setAdminSession, isAdminAuthed } from '@/services/admin'
import PrimaryButton from '@/components/PrimaryButton'
import type { AdminSession } from '@/types/admin'
import styles from './index.module.scss'

export default function AdminLoginPage() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 已登录时一键进入
  const [already] = useState(() => isAdminAuthed())

  const doLogin = async () => {
    if (!username.trim() || !password) {
      setError('请输入账号与密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await callAdmin<AdminSession>('adminLogin', {
        username: username.trim(),
        password,
      })
      setAdminSession(res.token, res.username || username.trim(), res.level || 'admin')
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/admin/dashboard/index' })
      }, 300)
    } catch (err) {
      console.error('[AdminLogin] 登录失败', err)
      setError((err as Error).message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  const enterDash = () => {
    Taro.redirectTo({ url: '/pages/admin/dashboard/index' })
  }

  return (
    <View className={styles.page}>
      <View className={styles.brand}>
        <Text className={styles.brandTag}>家教后台</Text>
        <Text className={styles.brandTitle}>小小陪伴帮 · 管理后台</Text>
        <Text className={styles.brandSub}>仅管理员账号可登录</Text>
      </View>

      <View className={styles.card}>
        <View className={styles.fieldBlock}>
          <Text className={styles.fieldLabel}>账号</Text>
          <Input
            className={styles.input}
            value={username}
            placeholder="admin"
            placeholderStyle="color:#c3c4b8"
            onInput={(e) => setUsername(e.detail.value)}
          />
        </View>

        <View className={styles.fieldBlock}>
          <Text className={styles.fieldLabel}>密码</Text>
          <Input
            className={styles.input}
            password
            value={password}
            placeholder="请输入密码"
            placeholderStyle="color:#c3c4b8"
            onInput={(e) => setPassword(e.detail.value)}
            onConfirm={() => doLogin()}
          />
        </View>

        {error ? <Text className={styles.error}>{error}</Text> : null}

        <View className={styles.loginBtn}>
          <PrimaryButton onClick={doLogin} disabled={loading}>
            {loading ? '登录中…' : '登录后台'}
          </PrimaryButton>
        </View>

        {already ? (
          <View style={{ marginTop: '24rpx' }}>
            <PrimaryButton onClick={enterDash}>已登录 · 直接进入后台</PrimaryButton>
          </View>
        ) : null}

        <Text className={styles.note}>
          管理账号由超级管理员开通后发放，请勿对外公开。登录凭证仅保存在本机，退出后台即清除；连续输错请核对账号是否已停用。
        </Text>
      </View>
    </View>
  )
}
