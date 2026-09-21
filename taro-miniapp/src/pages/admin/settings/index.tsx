import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callAdmin, clearAdminSession, getAdminUser, guardAdminPage, logoutAdmin } from '@/services/admin'
import PrimaryButton from '@/components/PrimaryButton'
import styles from './index.module.scss'

export default function AdminSettingsPage() {
  const user = getAdminUser()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // 老师专属编号补发
  const [assignBusy, setAssignBusy] = useState(false)
  const [assignMsg, setAssignMsg] = useState('')

  useEffect(() => {
    guardAdminPage()
  }, [])

  const assignNumbers = async () => {
    if (assignBusy) return
    setAssignBusy(true)
    setAssignMsg('')
    try {
      const res = await callAdmin<{ assigned: number; normalized: number; passed: number; accounts: number }>(
        'assignTeacherNumbers'
      )
      setAssignMsg(
        `处理完成：新发 ${res.assigned} 个编号，修复归一 ${res.normalized || 0} 条历史记录，覆盖 ${res.accounts} 个老师账号（已认证 ${res.passed} 条）`
      )
    } catch (err) {
      console.error('[AdminSettings] 补发编号失败', err)
      setAssignMsg((err as Error).message || '补发失败，请重试')
    } finally {
      setAssignBusy(false)
    }
  }

  const changePassword = async () => {
    if (busy) return
    setError('')
    setSuccess('')
    if (!oldPassword) {
      setError('请输入当前密码')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }

    Taro.showModal({
      title: '确认修改密码',
      content: '修改后旧会话将立即失效，需用新密码重新登录，确认继续？',
      confirmText: '确认修改',
      cancelText: '取消',
      success(res) {
        if (!res.confirm) return
        doChange()
      },
    })
  }

  const doChange = async () => {
    setBusy(true)
    setError('')
    try {
      await callAdmin('adminChangePassword', { oldPassword, newPassword })
      setSuccess('密码已修改，请重新登录')
      // 旧 token 已被云端作废
      clearAdminSession()
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/admin/login/index' })
      }, 1200)
    } catch (err) {
      console.error('[AdminSettings] 改密失败', err)
      setError((err as Error).message || '修改失败')
    } finally {
      setBusy(false)
    }
  }

  const confirmLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '退出后需重新输入账号密码才能进入后台，确认退出吗？',
      confirmText: '退出',
      cancelText: '取消',
      success(res) {
        if (res.confirm) logoutAdmin()
      },
    })
  }

  return (
    <View className="admPage">
      <View className="admCard">
        <Text className="admCardTitle" style={{ display: 'block' }}>账号信息</Text>
        <View className="admField">
          <Text className="admFieldKey">账号</Text>
          <Text className="admFieldVal">{user.username || '—'}</Text>
        </View>
        <View className="admField">
          <Text className="admFieldKey">权限等级</Text>
          <Text className="admFieldVal">{user.level || 'admin'}</Text>
        </View>
      </View>

      <View className="admCard">
        <Text className="admCardTitle" style={{ display: 'block' }}>修改登录密码</Text>
        <Text className="admCardSub">修改成功后当前会话将失效，需用新密码重新登录。</Text>

        <View className={styles.formGroup} style={{ marginTop: '20rpx' }}>
          <Text className={styles.label}>当前密码</Text>
          <Input
            className={styles.input}
            password
            value={oldPassword}
            placeholder="请输入当前密码"
            placeholderStyle="color:#c3c4b8"
            onInput={(e) => setOldPassword(e.detail.value)}
          />
        </View>
        <View className={styles.formGroup}>
          <Text className={styles.label}>新密码（至少 6 位）</Text>
          <Input
            className={styles.input}
            password
            value={newPassword}
            placeholder="请输入新密码"
            placeholderStyle="color:#c3c4b8"
            onInput={(e) => setNewPassword(e.detail.value)}
          />
        </View>
        <View className={styles.formGroup}>
          <Text className={styles.label}>确认新密码</Text>
          <Input
            className={styles.input}
            password
            value={confirmPassword}
            placeholder="再次输入新密码"
            placeholderStyle="color:#c3c4b8"
            onInput={(e) => setConfirmPassword(e.detail.value)}
          />
        </View>

        {error ? <Text className="admErrorText">{error}</Text> : null}
        {success ? <Text style={{ color: '#2d7a54', fontSize: '26rpx', display: 'block', marginBottom: '12rpx' }}>{success}</Text> : null}

        <PrimaryButton onClick={changePassword} disabled={busy}>
          {busy ? '修改中…' : '确认修改密码'}
        </PrimaryButton>
      </View>

      <View className="admCard">
        <Text className="admCardTitle" style={{ display: 'block' }}>老师专属编号</Text>
        <Text className="admCardSub">
          认证通过后自动颁发唯一 5 位编号（按认证成功先后顺序依次累加）。此处可为历史已通过认证的老师补发编号。
        </Text>
        {assignMsg ? (
          <Text style={{ color: '#2d7a54', fontSize: '24rpx', display: 'block', margin: '16rpx 0' }}>{assignMsg}</Text>
        ) : null}
        <View style={{ marginTop: '16rpx' }}>
          <View className="admBtn admBtnGreen" style={{ height: '80rpx' }} onClick={assignNumbers}>
            <Text>{assignBusy ? '补发中…' : '补发历史老师编号'}</Text>
          </View>
        </View>
      </View>

      <View className={styles.logoutRow}>
        <View className="admBtn admBtnRed" style={{ width: '100%', height: '88rpx' }} onClick={confirmLogout}>
          <Text>退出登录</Text>
        </View>
      </View>
    </View>
  )
}
