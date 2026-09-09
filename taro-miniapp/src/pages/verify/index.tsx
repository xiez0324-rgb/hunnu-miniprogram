import { View, Text, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import NavBar from '@/components/NavBar'
import PrimaryButton from '@/components/PrimaryButton'
import StatusTag from '@/components/StatusTag'
import RiskNote from '@/components/RiskNote'
import { ensureWechatPrivacy } from '@/services/privacy'
import { pickAndUploadMaterial, formatMB, type UploadedMaterial } from '@/utils/verifyUpload'
import { PARTNER_SCHOOL, SCHOOL_LOCK_HINT } from '@/constants/partner'
import styles from './index.module.scss'

// 认证材料槽位：真实提交会对应生成一张照片（相册选图，压缩到 1~2MB）
const SLOTS = [
  { key: 'card', name: '学生证', hint: '学生证 / 校园卡照片' },
  { key: 'xueli', name: '学信网截图', hint: '学籍在线验证截图' },
] as const

type SlotKey = (typeof SLOTS)[number]['key']

export default function VerifyPage() {
  const [name, setName] = useState('')
  const [college, setCollege] = useState('')
  const [major, setMajor] = useState('')
  const [authorized, setAuthorized] = useState(true)
  // 材料上传结果：云存储 fileID（admin 端可据此取临时 URL 查看原图）
  const [materials, setMaterials] = useState<Record<SlotKey, UploadedMaterial | null>>({
    card: null,
    xueli: null,
  })
  const [busyKey, setBusyKey] = useState<SlotKey | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [lastSizeHint, setLastSizeHint] = useState('')

  // 优先回填真实姓名（老师登录/档案里的称呼；实名认证仅面向老师端）
  useEffect(() => {
    callFunction<{ profile: { nickname?: string } | null }>('getProfile', { role: 'teacher' })
      .then((res) => {
        const nick = res.profile?.nickname || ''
        if (nick && nick !== '张同学') setName(nick)
      })
      .catch(() => {
        /* 读取失败忽略，允许手填 */
      })
  }, [])

  const pickFor = async (key: SlotKey) => {
    if (submitting) return
    // 相册属于隐私接口，微信要求使用前先完成隐私授权
    ensureWechatPrivacy()
    setBusyKey(key)
    setLastSizeHint('')
    try {
      const label = SLOTS.find((s) => s.key === key)?.name || '材料'
      const material = await pickAndUploadMaterial(label)
      if (!material) {
        // 非小程序环境（H5 预览）无相册能力
        Taro.showToast({ title: '请使用微信小程序从相册上传照片', icon: 'none' })
        return
      }
      setMaterials((prev) => ({ ...prev, [key]: material }))
      if (material.size) {
        setLastSizeHint(`${label}：压缩后 ${formatMB(material.size)}`)
      }
      Taro.showToast({ title: `${label}照片已就绪`, icon: 'success' })
    } catch (err) {
      const msg = (err as Error)?.message || '上传失败'
      Taro.showToast({ title: msg.includes('cancel') ? '已取消选择' : msg, icon: 'none' })
    } finally {
      setBusyKey(null)
    }
  }

  const removeMaterial = (key: SlotKey) => {
    setMaterials((prev) => ({ ...prev, [key]: null }))
  }

  const canSubmit = () => {
    const slotsFilled = Object.values(materials).filter(Boolean).length
    if (!name.trim()) return '请填写真实姓名'
    if (!college.trim()) return '请填写学院名称'
    if (!major.trim()) return '请填写专业名称'
    if (slotsFilled < 1) return '请至少上传 1 张学籍材料照片'
    return null
  }

  const submit = async () => {
    const msg = canSubmit()
    if (msg) {
      Taro.showToast({ title: msg, icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const list = Object.values(materials).filter(Boolean) as UploadedMaterial[]
      // 学校字段由后端统一锁定为平台合作院校（湖南师范大学），前端不再采集
      await callFunction('submitVerification', {
        name: name.trim(),
        college: college.trim(),
        major: major.trim(),
        materials: list.map((m) => ({ name: m.name, fileID: m.fileID })),
        authorized,
      })
      setSubmitted(true)
      Taro.showToast({ title: '已提交，等待管理员审核', icon: 'success' })
    } catch (err) {
      console.error('[Verify] 提交认证失败', err)
      Taro.showToast({ title: (err as Error)?.message || '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={styles.page}>
      <NavBar title="实名 + 学籍认证" onBack={() => Taro.navigateBack()} />

      <View className={styles.card}>
        <Text className={styles.benefit}>
          认证通过后展示「已认证」标签，被代理人推荐的概率更高。提交后由平台管理员在线核对照片与学籍信息。
        </Text>

        <View className={styles.fieldBlock}>
          <Text className={styles.fieldLabel}>真实姓名</Text>
          <Input
            className={styles.input}
            value={name}
            placeholder="请输入与学籍一致的姓名"
            placeholderClass={styles.placeholder}
            onInput={(e) => setName(e.detail.value)}
          />
        </View>

        <View className={styles.fieldBlock}>
          <Text className={styles.fieldLabel}>在读学校</Text>
          <View className={styles.schoolFixed}>
            <Text className={styles.schoolFixedName}>{PARTNER_SCHOOL}</Text>
            <Text className={styles.schoolFixedHint}>{SCHOOL_LOCK_HINT}</Text>
          </View>
        </View>

        <View className={styles.fieldBlock}>
          <Text className={styles.fieldLabel}>学院名称</Text>
          <Input
            className={styles.input}
            value={college}
            placeholder="请输入所在学院全称，如：数学与统计学院"
            placeholderClass={styles.placeholder}
            onInput={(e) => setCollege(e.detail.value)}
          />
        </View>

        <View className={styles.fieldBlock}>
          <Text className={styles.fieldLabel}>专业名称</Text>
          <Input
            className={styles.input}
            value={major}
            placeholder="请输入所学专业，如：数学与应用数学"
            placeholderClass={styles.placeholder}
            onInput={(e) => setMajor(e.detail.value)}
          />
        </View>

        <View className={styles.uploadGrid}>
          {SLOTS.map((slot) => {
            const current = materials[slot.key]
            return (
              <View key={slot.key} className={styles.slotBox}>
                {current ? (
                  <View className={styles.slotPreview}>
                    <Image className={styles.slotImg} src={current.fileID} mode="aspectFill" />
                    <Text className={styles.slotCheck}>✓</Text>
                    <View className={styles.slotRemove} onClick={() => removeMaterial(slot.key)}>
                      删除
                    </View>
                  </View>
                ) : (
                  <View className={styles.uploadBox} onClick={() => pickFor(slot.key)}>
                    <Text className={styles.uploadPlus}>{busyKey === slot.key ? '…' : '+'}</Text>
                    <Text className={styles.uploadText}>{busyKey === slot.key ? '压缩上传中' : slot.name}</Text>
                    <Text className={styles.uploadHint}>{slot.hint}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
        {lastSizeHint ? <Text className={styles.sizeHint}>{lastSizeHint}</Text> : null}
        <Text className={styles.authHint}>
          从手机相册选择，系统会自动压缩至 1~2MB 后上传；提交后管理员可在后台查看原图核对真实性。
        </Text>

        <View className={styles.authRow} onClick={() => setAuthorized(!authorized)}>
          <View className={styles.checkbox}>
            {authorized ? <Text className={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text className={styles.authText}>授权在简历中展示学院与专业信息</Text>
        </View>
        <Text className={styles.authHint}>
          {authorized
            ? '已授权：审核通过后您的学院与专业将展示在简历中，便于家长了解您的学业背景。'
            : '未授权：学院与专业仅用于平台内部核验，不会展示在简历中。'}
        </Text>

        <RiskNote>
          隐私提示：上传前请对学生证号、学号、身份证号等敏感信息进行打码处理，仅保留学校名称与姓名。照片仅用于学籍真实性核验，平台不会对外公开。
        </RiskNote>

        <View className={styles.footer}>
          {submitted ? (
            <View className={styles.statusRow}>
              <StatusTag status="待审核" />
            </View>
          ) : null}
          <PrimaryButton onClick={submit} disabled={submitting || submitted}>
            {submitting ? '提交中…' : submitted ? '已提交，等待审核' : '提交认证'}
          </PrimaryButton>
        </View>
      </View>
    </View>
  )
}
