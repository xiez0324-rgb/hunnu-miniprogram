import { View, Text, Input } from '@tarojs/components'
import classnames from 'classnames'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { callFunction } from '@/services/cloud'
import { districts, genders } from '@/data/shared'
import { onlyDigits } from '@/utils'
import Chip from '@/components/Chip'
import MultiPick from '@/components/MultiPick'
import FieldLabel from '@/components/FieldLabel'
import SelectField from '@/components/SelectField'
import PrimaryButton from '@/components/PrimaryButton'
import RiskNote from '@/components/RiskNote'
import PlatformRecordNotice from '@/components/PlatformRecordNotice'
import styles from './index.module.scss'

const gradeOptions = [
  '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
  '初一', '初二', '初三', '高一', '高二', '高三',
]

// 需求类型（贴近家政 / 陪伴服务的选择）
const goalOptions = ['长期固定需求', '短期临时需求', '假期集中需求', '灵活按需']

const timeSlots = ['周一至周五晚', '周六全天', '周日全天', '周末均可']

const EXTRA_SUBJECTS = ['音乐', '美术', '少儿编程', '羽毛球', '篮球', '钢琴']

const MAIN_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']

const REF_BUDGET: Record<'小学' | '初中' | '高中', { main: [number, number]; extra: [number, number] }> = {
  小学: { main: [80, 120], extra: [100, 160] },
  初中: { main: [100, 150], extra: [110, 180] },
  高中: { main: [120, 180], extra: [130, 220] },
}

const stageOf = (g: string) =>
  g.includes('小学') ? '小学' : g.includes('初') ? '初中' : g.includes('高') ? '高中' : null

export default function Publish() {
  const [agreed, setAgreed] = useState(false)
  const [gender, setGender] = useState('不限')
  const [budgetMin, setBudgetMin] = useState('100')
  const [budgetMax, setBudgetMax] = useState('150')
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  const [goal, setGoal] = useState('')
  const [location, setLocation] = useState('')
  const [timePicked, setTimePicked] = useState<string[]>([timeSlots[0]!])
  const [areaPicked, setAreaPicked] = useState<string[]>([districts[0]!])
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const budgetDirty = useRef(false)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // 预填个人资料里已填写的联系电话：平台需电话与家长对接核实，已填则无需重复输入
  useEffect(() => {
    callFunction<{ profile: { phone?: string } | null }>('getProfile', { role: 'parent' })
      .then((res) => {
        const p = res.profile
        if (p && p.phone) setPhone(p.phone)
      })
      .catch(() => {
        /* 读取失败不影响后续填写 */
      })
      .finally(() => setLoadingProfile(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stage = stageOf(grade)

  const applyRefBudget = (s: '小学' | '初中' | '高中', isExtra: boolean) => {
    const ref = REF_BUDGET[s][isExtra ? 'extra' : 'main']
    setBudgetMin(String(ref[0]))
    setBudgetMax(String(ref[1]))
  }

  const handleGradeChange = (g: string) => {
    setGrade(g)
    budgetDirty.current = false
    const s = stageOf(g)
    if (s) applyRefBudget(s, false)
  }

  const budgetValid = !(budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax))
  const phoneValid = /^1\d{10}$/.test(phone)
  const subjectTrimmed = subject.trim()
  const [submitting, setSubmitting] = useState(false)

  // 逐项校验并返回「第一条未满足项」的明确提示：按钮不再静默禁用，点一下就知道差什么
  const validate = (): string | null => {
    if (!grade) return '请选择孩子年级'
    if (!subjectTrimmed) return '请填写孩子的需求'
    if (!goal) return '请选择需求类型'
    if (!location.trim()) return '请填写服务地点（精确到小区）'
    if (!budgetValid) return '最低预算不能高于最高预算，请调整'
    if (!phone) return '请填写联系电话，便于平台工作人员及时与您对接'
    if (!phoneValid) return `手机号需为 11 位数字，当前已填 ${phone.length} 位`
    if (!agreed) return '请先阅读并勾选同意《用户服务协议》和《隐私与风险说明》'
    return null
  }
  // 实时提示：让用户在点击前也能看到还差什么
  const pendingHint = submitting ? null : validate()

  const submit = async () => {
    if (submitting) return
    const msg = validate()
    if (msg) {
      Taro.showToast({ title: msg, icon: 'none' })
      return
    }
    const main = MAIN_SUBJECTS.find((s) => subjectTrimmed.includes(s))
    const extra = EXTRA_SUBJECTS.find((s) => subjectTrimmed.includes(s))
    const category = main
      ? '主科'
      : ['羽毛球', '篮球'].includes(extra || '')
      ? '体育'
      : ['音乐', '美术', '钢琴'].includes(extra || '')
      ? '艺术'
      : extra
      ? '编程'
      : '主科'
    const payload = {
      grade,
      subject: subjectTrimmed,
      category,
      title: goal,
      goal,
      time: timePicked.join(' / '),
      budget: `${budgetMin}-${budgetMax} 元/时`,
      area: `${areaPicked.join(' / ')} · ${location}`,
      gender,
      phone,
      note,
    }
    setSubmitting(true)
    try {
      await callFunction('createDemand', payload)
      Taro.redirectTo({ url: '/pages/publish-success/index' })
    } catch (err) {
      console.error('[Publish] 提交需求信息失败', err)
      Taro.showToast({ title: (err as Error)?.message || '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>登记需求信息</Text>
        <Text className={styles.headerTip}>填写孩子的基本信息，信息由平台录入核验后为您匹配合适的老师</Text>
      </View>

      {/* 合规提示：平台为信息的唯一收集者与发布者 */}
      <PlatformRecordNotice desc="您填写的信息由平台工作人员统一录入、审核后发布，您不会直接对外发布任何内容；信息仅用于为您匹配与对接服务。" />

      <View className={styles.card}>
        <SelectField
          label="孩子年级"
          value={grade}
          placeholder="请选择年级"
          options={gradeOptions}
          onChange={(v) => handleGradeChange(v as string)}
          required
        />
        <FieldLabel label="孩子的需求" hint="请填写孩子/家庭的真实需求，例如：陪伴写作业、陪读、日常照护、接送、兴趣活动陪伴等" required>
          <Input
            className={styles.input}
            value={subject}
            placeholder="请填写具体需求，如：放学后陪伴写作业"
            placeholderClass={styles.placeholder}
            onInput={(e) => setSubject(e.detail.value)}
          />
        </FieldLabel>
        <SelectField
          label="需求类型"
          value={goal}
          placeholder="请选择类型"
          options={goalOptions}
          onChange={(v) => setGoal(v as string)}
          required
        />

        <FieldLabel label="偏好老师">
          <View className={styles.chips}>
            {genders.map((g) => (
              <Chip key={g} active={gender === g} onClick={() => setGender(g)}>
                {g}
              </Chip>
            ))}
          </View>
        </FieldLabel>

        <MultiPick label="期望时段（可多选）" options={timeSlots} value={timePicked} onChange={setTimePicked} />
        <MultiPick label="服务区域（行政区 · 可多选）" options={districts} value={areaPicked} onChange={setAreaPicked} />

        <FieldLabel
          label="服务地点（精确到小区）"
          hint="选择行政区后，请在此填写小区/地标与楼栋，便于服务人员判断通勤距离"
          required
        >
          <Input
            className={styles.input}
            placeholder="如：麓山名园 X 栋 / 师大附小旁"
            placeholderClass={styles.placeholder}
            value={location}
            onInput={(e) => setLocation(e.detail.value)}
          />
        </FieldLabel>

        <FieldLabel label="联系电话" hint="便于平台工作人员与您电话对接核实；由平台录入保管，不会公开展示">
          <Input
            className={styles.input}
            type="number"
            maxlength={11}
            value={phone}
            placeholder={loadingProfile ? '读取个人资料中…' : '请输入 11 位手机号'}
            placeholderClass={styles.placeholder}
            onInput={(e) => setPhone(onlyDigits(e.detail.value))}
          />
          {phone.length > 0 && !phoneValid ? (
            <Text className={styles.budgetError}>
              手机号需为 11 位数字，当前已填 {phone.length} 位，请补全后再提交。
            </Text>
          ) : null}
        </FieldLabel>

        <FieldLabel
          label="预算范围（元/时）"
          hint={
            stage
              ? `已按「${stage}学段${EXTRA_SUBJECTS.some((x) => subjectTrimmed.includes(x)) ? ' · 兴趣特长类' : ' · 综合服务类'}」自动带入市场参考区间，可自行微调`
              : undefined
          }
        >
          <View className={styles.budgetRow}>
            <Input
              className={styles.budgetInput}
              type="number"
              value={budgetMin}
              onInput={(e) => {
                budgetDirty.current = true
                setBudgetMin(onlyDigits(e.detail.value))
              }}
            />
            <Text className={styles.budgetDash}>—</Text>
            <Input
              className={styles.budgetInput}
              type="number"
              value={budgetMax}
              onInput={(e) => {
                budgetDirty.current = true
                setBudgetMax(onlyDigits(e.detail.value))
              }}
            />
            <Text className={styles.budgetUnit}>元/时</Text>
          </View>
          {!budgetValid && (
            <Text className={styles.budgetError}>最低预算不能高于最高预算，请调整。</Text>
          )}
        </FieldLabel>

        <FieldLabel label="补充说明（选填）">
          <Input
            className={styles.input}
            value={note}
            placeholder="如：孩子性格、其他要求及备注等"
            placeholderClass={styles.placeholder}
            onInput={(e) => setNote(e.detail.value)}
          />
        </FieldLabel>
      </View>

      <RiskNote>本平台仅提供信息录入、核验与对接协助，不代收课时费。信息由平台统一录入后发布，用户不直接对外发布内容。老师的身份与学籍信息由平台工作人员人工核验，如发现信息不实，请立即联系平台客服 Kiki，我们将承担责任并跟进处理。</RiskNote>

      <View className={styles.agreeRow} onClick={() => setAgreed(!agreed)}>
        <View className={classnames(styles.checkbox, agreed && styles.checkboxChecked)}>
          {agreed ? <Text className={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text className={styles.agreeText}>
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

      {pendingHint ? <Text className={styles.pendingHint}>{pendingHint}</Text> : null}

      <PrimaryButton onClick={submit} disabled={submitting}>
        {submitting ? '提交中…' : '提交登记（由平台审核后统一发布）'}
      </PrimaryButton>
    </View>
  )
}
