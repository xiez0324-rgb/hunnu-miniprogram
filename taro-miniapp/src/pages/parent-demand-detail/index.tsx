import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import { agentWechat } from '@/data/shared'
import type { Applicant } from '@/types'
import NavBar from '@/components/NavBar'
import SectionTitle from '@/components/SectionTitle'
import TeacherCard from '@/components/TeacherCard'
import PrimaryButton from '@/components/PrimaryButton'
import GhostButton from '@/components/GhostButton'
import StatusTag from '@/components/StatusTag'
import ConfirmDialog from '@/components/ConfirmDialog'
import styles from './index.module.scss'

export default function ParentDemandDetailPage() {
  const router = useRouter()
  const [demandId, setDemandId] = useState('1024')
  const [recommended, setRecommended] = useState<Applicant[]>([])
  const [others, setOthers] = useState<Applicant[]>([])
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const [inquirySent, setInquirySent] = useState<string[]>([])
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null)
  const [askingContact, setAskingContact] = useState(false)
  const [loadError, setLoadError] = useState('')
  // 微信内二次确认后展示 open-type=contact 客服按钮；浏览器/H5 直接走复制微信号降级
  const [contactReady, setContactReady] = useState(false)
  const isWeapp = process.env.TARO_ENV === 'weapp'

  // 联系代理人：先二次确认，再按环境拉起（微信客服 / 复制微信号引导添加）
  const openContact = () => {
    setAskingContact(false)
    if (isWeapp) {
      setContactReady(true)
      Taro.showToast({ title: '请点击下方客服按钮开始沟通', icon: 'none' })
      return
    }
    // 外部浏览器（H5 预览）无法唤起微信客服：复制客服微信号并引导
    Taro.setClipboardData({
      data: agentWechat,
      success: () => {
        Taro.showToast({ title: '客服微信号已复制，请前往微信添加 Kiki', icon: 'none' })
      },
      fail: () => {
        Taro.showToast({ title: `复制失败，请手动记录客服微信号：${agentWechat}`, icon: 'none' })
      },
    })
  }

  useEffect(() => {
    const id = router.params.id || '1024'
    setDemandId(id)
    setLoadError('')
    callFunction<{ recommended: Applicant[]; others: Applicant[]; confirmedTeacherId?: string }>('getApplicants', {
      demandId: id,
    }).then((res) => {
      setRecommended(res.recommended)
      setOthers(res.others)
      // 回显已确认人选：状态持久化在云端，重新进入页面时保留，避免重复确认
      setConfirmed(res.confirmedTeacherId || null)
    }).catch((err) => {
      console.error('[ParentDemandDetail] 获取报名者失败', err)
      // 越权/已下架等场景：把后端提示展示给用户，避免白屏被误认为 bug
      setLoadError((err as Error)?.message || '加载报名信息失败，请稍后重试')
    })
  }, [router.params.id])

  // 确认人选：先弹二次确认，避免误触；同一需求只允许一条有效确认（后端幂等回退旧确认）
  const doConfirm = async () => {
    if (!pendingConfirm) return
    const teacherId = pendingConfirm
    setPendingConfirm(null)
    const prev = confirmed
    setConfirmed(teacherId)
    try {
      await callFunction('confirmMatch', { demandId, teacherId })
      Taro.showToast({ title: '已确认该老师', icon: 'success' })
    } catch (err) {
      console.error('[ParentDemandDetail] 确认失败', err)
      // 云端失败则回退本地状态，避免出现「界面已确认但数据库未落库」的假象
      setConfirmed(prev)
      Taro.showToast({ title: (err as Error)?.message || '确认失败，请重试', icon: 'none' })
    }
  }

  // 取消确认：释放当前人选，可再选择其它老师
  const cancelConfirm = async (teacherId: string) => {
    try {
      await callFunction('cancelConfirm', { demandId, teacherId })
      setConfirmed(null)
      Taro.showToast({ title: '已取消确认', icon: 'none' })
    } catch (err) {
      console.error('[ParentDemandDetail] 取消确认失败', err)
      Taro.showToast({ title: (err as Error)?.message || '取消确认失败，请重试', icon: 'none' })
    }
  }

  // 想进一步了解该老师：通知代理人处理
  const requestInfo = (teacherId: string) => {
    if (inquirySent.includes(teacherId)) return
    setInquirySent((prev) => [...prev, teacherId])
    callFunction('requestTeacherInfo', { demandId, teacherId }).catch((err) => {
      console.error('[ParentDemandDetail] 发送了解请求失败', err)
    })
    Taro.showToast({ title: '已通知平台，工作人员将尽快联系您', icon: 'none' })
  }

  // 查看老师完整简历
  const viewResume = (teacherId: string) => {
    Taro.navigateTo({ url: `/pages/teacher-detail/index?id=${teacherId}` })
  }

  // 已确认老师姓名（用于「报名进度」状态标识）
  const confirmedName = confirmed
    ? [...recommended, ...others].find((t) => t.id === confirmed)?.name || ''
    : ''

  const renderFooter = (id: string) => {
    const isConfirmed = confirmed === id
    return (
      <View>
        {isConfirmed ? (
          <View>
            <GhostButton disabled>已确认该老师</GhostButton>
            <View className={styles.confirmNote}>
              <Text className={styles.confirmNoteText}>✅ 已通知平台处理，工作人员将尽快联系您线下对接</Text>
            </View>
            <View className={styles.cancelRow}>
              <GhostButton onClick={() => cancelConfirm(id)}>取消确认，改选其他老师</GhostButton>
            </View>
          </View>
        ) : (
          <View>
            <PrimaryButton disabled={confirmed !== null} onClick={() => setPendingConfirm(id)}>
              {confirmed !== null ? '已确认其他老师' : '确认选择该老师'}
            </PrimaryButton>
            <View className={styles.infoRow}>
              <GhostButton
                disabled={inquirySent.includes(id)}
                onClick={() => requestInfo(id)}
              >
                {inquirySent.includes(id) ? '已通知平台' : '想进一步了解该老师'}
              </GhostButton>
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <NavBar title="需求详情" onBack={() => Taro.navigateBack()} />

      <View className={styles.demandCard}>
        <View className={styles.demandHead}>
          <Text className={styles.demandTitle}>需求 #{demandId}</Text>
          <StatusTag status="进行中" />
        </View>
        <Text className={styles.demandMeta}>报名进度：{recommended.length + others.length} 人报名</Text>
        {confirmed ? (
          <Text className={styles.confirmedBadge}>
            ✅ 已确认老师：{confirmedName || '已确认人选'}（如需更换请先取消确认）
          </Text>
        ) : null}
        <Text className={styles.demandHint}>
          说明：本需求仅可确认 1 位老师；已确认后如需更换，请先「取消确认」再选择其他老师。
        </Text>
      </View>

      {loadError ? (
        <View className={styles.confirmNote}>
          <Text className={styles.confirmNoteText}>⚠️ {loadError}</Text>
        </View>
      ) : null}

      {recommended.length > 0 ? (
        <SectionTitle primary>⭐ 平台推荐人选（置顶）</SectionTitle>
      ) : null}
      {recommended.map((t, i) => (
        <TeacherCard
          key={t.id}
          applicant={t}
          index={i}
          footer={renderFooter(t.id)}
          onViewResume={() => viewResume(t.id)}
        />
      ))}

      {others.length > 0 ? <SectionTitle>其他报名老师</SectionTitle> : null}
      {others.map((t, i) => (
        <TeacherCard
          key={t.id}
          applicant={t}
          index={recommended.length + i}
          footer={renderFooter(t.id)}
          onViewResume={() => viewResume(t.id)}
        />
      ))}

      {confirmed ? (
        <View className={styles.confirmNote}>
          <Text className={styles.confirmNoteText}>
            ✅ 主选已确认。如仍想对比体验服务，可对其他老师点「想进一步了解」，平台工作人员将为您协调安排。
          </Text>
        </View>
      ) : null}

      <View className={styles.contactCard}>
        <View className={styles.contactInfo}>
          <Text className={styles.contactTitle}>💬 需求疑问？直接问平台</Text>
          <Text className={styles.contactDesc}>催办推荐、更换人选、取消需求等，一键联系平台客服（Kiki）</Text>
        </View>
        <View className={styles.contactBtn}>
          {contactReady ? (
            <Button
              className={styles.customerBtn}
              openType="contact"
              onContact={() => Taro.showToast({ title: '客服会话已打开，请描述您的需求', icon: 'none' })}
            >
              联系客服（Kiki）
            </Button>
          ) : (
            <PrimaryButton onClick={() => setAskingContact(true)}>联系平台</PrimaryButton>
          )}
        </View>
      </View>

      <View className={styles.bottomTip}>
        <Text className={styles.bottomTipText}>确认后平台将为你牵线对接，请保持电话畅通。</Text>
      </View>

      <ConfirmDialog
        visible={pendingConfirm !== null}
        title="确认选择该老师？"
        content="确认后该需求将锁定这位老师，平台会为你牵线对接；如需更换需先取消确认。"
        confirmText="确认选择"
        cancelText="我再想想"
        onConfirm={doConfirm}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmDialog
        visible={askingContact}
        title="联系平台客服"
        content={
          isWeapp
            ? '即将与平台客服（Kiki）沟通。确认后将唤起微信客服，可直接咨询催办推荐、更换人选、取消需求等事项。'
            : '即将复制平台客服（Kiki）的微信号，请前往微信添加后咨询。'
        }
        confirmText="去联系"
        cancelText="取消"
        onConfirm={openContact}
        onCancel={() => setAskingContact(false)}
      />
    </View>
  )
}
