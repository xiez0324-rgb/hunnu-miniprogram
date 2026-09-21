import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import { useUser } from '@/store/user'
import { onlyDigits, parentGenderLabel } from '@/utils'
import { isPlaceholderNickname } from '@/utils/nickname'
import type { Profile, UserGender } from '@/types'
import NavBar from '@/components/NavBar'
import FieldLabel from '@/components/FieldLabel'
import PrimaryButton from '@/components/PrimaryButton'
import RiskNote from '@/components/RiskNote'
import PlatformRecordNotice from '@/components/PlatformRecordNotice'
import styles from './index.module.scss'

const GENDERS: Array<{ value: UserGender; label: string }> = [
  { value: '女', label: '女士' },
  { value: '男', label: '男士' },
]

export default function ProfilePage() {
  const { role, refreshProfile } = useUser()
  const isTeacher = role === 'teacher'

  // 未命名时不预填占位名（老师需填写真实姓名），统一由 placeholder 提示
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState<UserGender | ''>('')
  const [phone, setPhone] = useState('')
  const [wechat, setWechat] = useState('')
  const [area, setArea] = useState('')
  const [saving, setSaving] = useState(false)

  // 拉取本人云端档案回填（权限：getProfile 按 role + openid 仅返回本人数据）
  useEffect(() => {
    callFunction<{ profile: Profile | null }>('getProfile', { role })
      .then((res) => {
        const p = res.profile
        if (p) {
          setNickname(isPlaceholderNickname(p.nickname) ? '' : p.nickname || '')
          setGender((p.gender as UserGender) || '')
          setPhone(p.phone || '')
          setWechat(p.wechat || '')
          setArea(p.area || '')
        }
      })
      .catch((err) => {
        console.error('[Profile] 读取个人信息失败', err)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validate = (): string | null => {
    if (isTeacher && !nickname.trim()) return '作为老师，请填写真实姓名'
    if (nickname.trim().length > 20) return '姓名不能超过 20 个字符'
    // 老师：性别会展示在简历「基础信息」中，与家长端展示对齐，必须填写
    if (isTeacher && !gender) return '请选择性别（将展示在您的简历中，供家长参考）'
    // 家长不填姓名时，必须选择性别，页面会用「女士/男士」前缀作为默认称呼
    if (!isTeacher && !nickname.trim() && !gender) return '请填写称呼，或选择性别（默认展示为「女士/男士」）'

    if (!phone) return '请填写联系电话，便于平台工作人员与您对接'
    if (!/^1\d{10}$/.test(phone)) return '手机号需为 11 位数字且以 1 开头'

    if (wechat.trim().length > 50) return '微信号过长（不超过 50 个字符）'

    if (isTeacher && !area.trim()) return '请填写所在区域'
    if (area.trim().length > 50) return '所在区域过长（不超过 50 个字符）'
    return null
  }

  const save = async () => {
    const msg = validate()
    if (msg) {
      Taro.showToast({ title: msg, icon: 'none' })
      return
    }
    setSaving(true)
    try {
      // 家长未填写姓名时，落库为性别前缀（女士/男士），保证「我的」页两处展示一致
      const finalNickname = nickname.trim() || (isTeacher ? '' : parentGenderLabel(gender || '女'))
      await callFunction('updateProfile', {
        role,
        nickname: finalNickname,
        gender: gender || '',
        phone,
        wechat: wechat.trim(),
        area: area.trim(),
      })
      // 同步到本地登录态，返回「我的」页顶部昵称立即一致
      refreshProfile()
      Taro.showToast({ title: '个人信息已保存', icon: 'success' })
    } catch (err) {
      console.error('[Profile] 保存个人信息失败', err)
      Taro.showToast({ title: (err as Error)?.message || '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const pickGender = (g: UserGender) => {
    setGender(g)
    // 老师填的是真实姓名，不随性别改写；家长未自定义称呼时才用性别前缀兜底
    if (isTeacher) return
    const cur = nickname.trim()
    if (!cur || cur === '女士' || cur === '男士') {
      setNickname(g === '男' ? '男士' : '女士')
    }
  }

  return (
    <View className={styles.page}>
      <NavBar title="个人信息" onBack={() => Taro.navigateBack()} />

      <View className={styles.card}>
        <Text className={styles.note}>
          平台工作人员会通过以下信息与您对接，请确保真实有效；除平台工作人员外不会向任何人展示。
        </Text>

        {/* 合规提示：平台为信息的唯一收集者与发布者 */}
        <PlatformRecordNotice desc="您填写的信息由平台统一录入、核验后用于为您对接服务；您不会直接对外发布任何内容，联系方式也不会公开展示。" />

        <FieldLabel label="身份标识">
          <View className={styles.identityRow}>
            <Text className={styles.identityValue}>{isTeacher ? '老师（我来接单）' : '家长（我有需求）'}</Text>
            <Text className={styles.identityHint}>身份在登录时选择，可在「我的」页切换</Text>
          </View>
        </FieldLabel>

        <FieldLabel label="姓名 / 称呼" required={isTeacher} hint={isTeacher ? '' : '不填则默认按性别展示「女士 / 男士」'}>
          <Input
            className={styles.input}
            value={nickname}
            placeholder={isTeacher ? '请输入真实姓名' : '请输入姓名或称呼，如：王女士'}
            placeholderClass={styles.placeholder}
            onInput={(e) => setNickname(e.detail.value)}
          />
        </FieldLabel>

        <FieldLabel
          label="性别"
          required={isTeacher}
          hint={
            isTeacher
              ? '会展示在您的简历「基础信息」中，供家长参考'
              : '用于匹配默认称呼「女士 / 男士」，不会对外展示'
          }
        >
          <View className={styles.genderRow}>
            {GENDERS.map((g) => (
              <View
                key={g.value}
                className={`${styles.genderChip} ${gender === g.value ? styles.genderActive : ''}`}
                onClick={() => pickGender(g.value)}
              >
                {g.label}
              </View>
            ))}
          </View>
        </FieldLabel>

        <FieldLabel label="联系电话" hint="便于平台工作人员与您电话对接；由平台录入保管，不会公开展示">
          <Input
            className={styles.input}
            value={phone}
            type="number"
            maxlength={11}
            placeholder="请输入 11 位手机号"
            placeholderClass={styles.placeholder}
            onInput={(e) => setPhone(onlyDigits(e.detail.value))}
          />
        </FieldLabel>

        <FieldLabel label="微信号（选填）" hint="便于平台工作人员添加您，不会公开展示">
          <Input
            className={styles.input}
            value={wechat}
            placeholder="请输入微信号"
            placeholderClass={styles.placeholder}
            onInput={(e) => setWechat(e.detail.value)}
          />
        </FieldLabel>

        <FieldLabel label="所在区域" required={isTeacher}>
          <Input
            className={styles.input}
            value={area}
            placeholder="请输入所在区域，可精确到小区，如：岳麓区 · 麓山名园"
            placeholderClass={styles.placeholder}
            onInput={(e) => setArea(e.detail.value)}
          />
        </FieldLabel>

        <RiskNote>
          姓名与联系方式仅用于平台工作人员对接、核验与通知，不会在广场公开展示。如填写虚假信息导致无法对接，平台不承担由此产生的损失。
        </RiskNote>

        <View className={styles.footer}>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存个人信息'}
          </PrimaryButton>
        </View>
      </View>

      <View className={styles.tipCard}>
        <Text className={styles.tipText}>
          修改个人信息后，平台将使用最新信息与您对接。若长时间未接到平台工作人员电话，请检查联系电话是否填写正确。
        </Text>
      </View>
    </View>
  )
}
