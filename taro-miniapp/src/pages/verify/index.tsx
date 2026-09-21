import { View, Text, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import NavBar from '@/components/NavBar'
import PrimaryButton from '@/components/PrimaryButton'
import StatusTag from '@/components/StatusTag'
import RiskNote from '@/components/RiskNote'
import PlatformRecordNotice from '@/components/PlatformRecordNotice'
import { ensureWechatPrivacyAsync } from '@/services/privacy'
import { isPlaceholderNickname } from '@/utils/nickname'
import { pickAndUploadMaterial, formatMB, type UploadedMaterial } from '@/utils/verifyUpload'
import type { GalleryImage } from '@/utils/imageUtil'
import ImageGallery from '@/components/ImageGallery'
import styles from './index.module.scss'

// 认证材料槽位：真实提交会对应生成一张照片（相册选图，压缩到 1~2MB）
const SLOTS = [
  { key: 'card', name: '学生证', hint: '学生证 / 校园卡照片' },
  { key: 'xueli', name: '学信网截图', hint: '学籍在线验证截图' },
] as const

type SlotKey = (typeof SLOTS)[number]['key']

// 认证状态：none=未提交；待审核/已通过=锁定；已驳回=清空后可重新上传
type VerifyStatus = 'none' | '待审核' | '已通过' | '已驳回'

interface CloudMaterial {
  name?: string
  fileID?: string
  url?: string
}

export default function VerifyPage() {
  // 云端认证状态
  const [status, setStatus] = useState<VerifyStatus>('none')
  const [loading, setLoading] = useState(true)
  const [rejectReason, setRejectReason] = useState('')
  const [teacherNo, setTeacherNo] = useState('')
  const [cloudMaterials, setCloudMaterials] = useState<CloudMaterial[]>([])

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
  const [lastSizeHint, setLastSizeHint] = useState('')
  // 材料照片大图浏览（原生预览优先）
  const [gallery, setGallery] = useState<{ visible: boolean; items: GalleryImage[]; current: number }>({
    visible: false,
    items: [],
    current: 0,
  })

  // 待审核 / 已通过 → 表单锁定不可编辑；已驳回 / 未提交 → 可编辑
  const locked = status === '待审核' || status === '已通过'
  const editable = !locked

  const isWeapp = process.env.TARO_ENV === 'weapp'

  // 读取云端认证状态（决定是否锁定页面）
  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await callFunction<{
        verification: {
          status?: string
          name?: string
          college?: string
          major?: string
          authorized?: boolean
          rejectReason?: string
          teacherNo?: string
          materials?: CloudMaterial[]
        } | null
      }>('getMyVerification')
      const v = res.verification
      if (v) {
        setStatus((v.status as VerifyStatus) || '待审核')
        setRejectReason(v.rejectReason || '')
        setTeacherNo(v.teacherNo || '')
        setCloudMaterials(v.materials || [])
        setCollege(v.college || '')
        setMajor(v.major || '')
        setAuthorized(v.authorized !== false)
        if (v.name) setName(v.name)
      } else {
        setStatus('none')
      }
    } catch (err) {
      console.error('[Verify] 读取认证状态失败', err)
    } finally {
      setLoading(false)
    }
  }

  // 未命名时用老师档案昵称预填真实姓名（仅在未提交/被驳回、且云端无姓名时生效）
  const prefillName = async () => {
    try {
      const res = await callFunction<{ profile: { nickname?: string } | null }>('getProfile', { role: 'teacher' })
      const nick = res.profile?.nickname || ''
      if (!isPlaceholderNickname(nick)) setName((prev) => prev || nick)
    } catch (err) {
      /* 读取失败忽略，允许手填 */
    }
  }

  useEffect(() => {
    loadStatus()
    prefillName()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 已锁定材料的大图浏览
  const previewCloudMaterial = (idx: number) => {
    const items = cloudMaterials.map<GalleryImage>((m, i) => ({
      key: `cloud_${i}`,
      name: m.name || `材料图${i + 1}`,
      fileID: m.fileID,
      src: m.url,
    }))
    setGallery({ visible: true, items, current: idx })
  }

  const previewMaterial = (slotKey: SlotKey) => {
    const m = materials[slotKey]
    if (!m) return
    const label = SLOTS.find((s) => s.key === slotKey)?.name || '材料照片'
    setGallery({ visible: true, items: [{ key: slotKey, name: label, fileID: m.fileID }], current: 0 })
  }

  // 长文案用弹窗展示（toast 会截断），便于定位真机上传失败原因
  const showError = (msg: string) => {
    if (msg.length > 18) {
      Taro.showModal({ title: '上传失败', content: msg, showCancel: false, confirmText: '我知道了' })
    } else {
      Taro.showToast({ title: msg, icon: 'none' })
    }
  }

  const pickFor = async (key: SlotKey) => {
    if (submitting || busyKey || locked) return
    // 相册/相机属于隐私接口：真机上必须先完成微信隐私授权，否则接口会直接失败
    const authorizedPrivacy = await ensureWechatPrivacyAsync()
    if (!authorizedPrivacy) {
      showError('请先同意《用户隐私保护指引》后再上传照片')
      return
    }
    setBusyKey(key)
    setLastSizeHint('')
    try {
      const label = SLOTS.find((s) => s.key === key)?.name || '材料'
      const material = await pickAndUploadMaterial(label)
      if (!material) {
        // 非小程序环境（H5 预览）无相册能力
        showError('请使用微信小程序从相册上传照片')
        return
      }
      setMaterials((prev) => ({ ...prev, [key]: material }))
      if (material.size) {
        setLastSizeHint(`${label}：压缩后 ${formatMB(material.size)}`)
      }
      Taro.showToast({ title: `${label}照片已就绪`, icon: 'success' })
    } catch (err) {
      const msg = (err as Error)?.message || '上传失败'
      console.error('[Verify] 上传材料失败', err)
      if (msg.includes('cancel')) {
        Taro.showToast({ title: '已取消选择', icon: 'none' })
      } else {
        showError(msg)
      }
    } finally {
      setBusyKey(null)
    }
  }

  const removeMaterial = (key: SlotKey) => {
    if (locked) return
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
    if (locked) {
      Taro.showToast({ title: '当前认证状态不可重复提交', icon: 'none' })
      return
    }
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
      // 提交即锁定：本地立即切换为「待审核」只读态，避免重复提交
      setStatus('待审核')
      setCloudMaterials(list.map((m) => ({ name: m.name, fileID: m.fileID })))
      Taro.showToast({ title: '已提交，等待管理员审核', icon: 'success' })
    } catch (err) {
      console.error('[Verify] 提交认证失败', err)
      Taro.showToast({ title: (err as Error)?.message || '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const materialSrc = (m: CloudMaterial): string => (isWeapp ? m.fileID || m.url || '' : m.url || '')

  return (
    <View className={styles.page}>
      <NavBar title="实名 + 学籍认证" onBack={() => Taro.navigateBack()} />

      <View className={styles.card}>
        {/* 合规提示：平台为信息的唯一收集者与发布者 */}
        <PlatformRecordNotice desc="您提交的资料由平台工作人员统一录入并人工核验，仅用于平台内部核验，您不会直接对外发布任何内容。" />

        {loading ? <Text className={styles.benefit}>正在读取认证状态…</Text> : null}

        {/* 认证状态条：待审核 / 已通过 时提示已锁定 */}
        {!loading && status !== 'none' ? (
          <View className={styles.statusCard}>
            <View className={styles.statusRowTop}>
              <StatusTag status={status} />
              {status === '已通过' && teacherNo ? (
                <Text className={styles.teacherNo}>认证编号：{teacherNo}</Text>
              ) : null}
            </View>
            {status === '待审核' ? (
              <Text className={styles.statusText}>
                资料已提交，平台审核中。为保证审核公正，学籍信息已<b>临时锁定不可修改</b>；若审核被驳回，系统将自动清空本次实名信息，届时可重新上传。
              </Text>
            ) : null}
            {status === '已通过' ? (
              <Text className={styles.statusText}>
                实名 + 学籍认证已通过，学籍信息已<b>固定为正式档案，不可修改</b>。如确需变更，请联系平台工作人员发起合规修改。
              </Text>
            ) : null}
            {status === '已驳回' ? (
              <Text className={styles.statusText}>
                审核未通过：{rejectReason || '资料不符合要求'}。
                本次提交的实名信息已清空，请按要求修改后重新上传。
              </Text>
            ) : null}
          </View>
        ) : null}

        {!loading && status === 'none' ? (
          <Text className={styles.benefit}>
            认证通过后展示「已认证」标签，被平台推荐的概率更高。提交后由平台工作人员在线核对照片与学籍信息。
          </Text>
        ) : null}

        <View className={styles.fieldBlock}>
          <Text className={styles.fieldLabel}>真实姓名</Text>
          <Input
            className={styles.input}
            value={name}
            disabled={locked}
            placeholder="请输入与学籍一致的姓名"
            placeholderClass={styles.placeholder}
            onInput={(e) => setName(e.detail.value)}
          />
        </View>

        <View className={styles.fieldBlock}>
          <Text className={styles.fieldLabel}>学院名称</Text>
          <Input
            className={styles.input}
            value={college}
            disabled={locked}
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
            disabled={locked}
            placeholder="请输入所学专业，如：数学与应用数学"
            placeholderClass={styles.placeholder}
            onInput={(e) => setMajor(e.detail.value)}
          />
        </View>

        {locked ? (
          // 锁定态：只读展示已提交的材料，不可上传/删除
          <View className={styles.uploadGrid}>
            {cloudMaterials.length === 0 ? (
              <Text className={styles.authHint}>暂无材料照片</Text>
            ) : (
              cloudMaterials.map((m, i) => (
                <View key={`${m.fileID || m.name}_${i}`} className={styles.slotBox}>
                  <View className={styles.slotPreview} onClick={() => previewCloudMaterial(i)}>
                    <Image className={styles.slotImg} src={materialSrc(m)} mode="aspectFill" />
                    <Text className={styles.lockedBadge}>已锁定</Text>
                    <Text className={styles.slotViewHint}>点击查看大图</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View className={styles.uploadGrid}>
            {SLOTS.map((slot) => {
              const current = materials[slot.key]
              return (
                <View key={slot.key} className={styles.slotBox}>
                  {current ? (
                    <View className={styles.slotPreview} onClick={() => previewMaterial(slot.key)}>
                      <Image className={styles.slotImg} src={current.fileID} mode="aspectFill" />
                      <Text className={styles.slotCheck}>✓</Text>
                      <View className={styles.slotRemove} onClick={(e) => { e.stopPropagation(); removeMaterial(slot.key) }}>
                        删除
                      </View>
                      <Text className={styles.slotViewHint}>点击查看大图</Text>
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
        )}
        {editable && lastSizeHint ? <Text className={styles.sizeHint}>{lastSizeHint}</Text> : null}
        {editable ? (
          <Text className={styles.authHint}>
            从手机相册选择，系统会自动压缩至 1~2MB 后上传；提交后管理员可在后台查看原图核对真实性。
          </Text>
        ) : null}

        <View className={styles.authRow} onClick={() => { if (!locked) setAuthorized(!authorized) }}>
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
          隐私提示：上传前请对学生证号、学号、身份证号等敏感信息进行打码处理。照片仅用于平台核验身份真实性，不会对外公开。
        </RiskNote>

        <View className={styles.footer}>
          {locked ? (
            <PrimaryButton disabled>
              {status === '待审核' ? '已提交，等待审核（信息已锁定）' : '认证已通过（学籍信息已固定）'}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={submit} disabled={submitting}>
              {submitting ? '提交中…' : status === '已驳回' ? '重新提交认证' : '提交认证'}
            </PrimaryButton>
          )}
        </View>
      </View>

      <ImageGallery
        items={gallery.items}
        current={gallery.current}
        visible={gallery.visible}
        onClose={() => setGallery((g) => ({ ...g, visible: false }))}
      />
    </View>
  )
}
