import { View, Text, Input } from '@tarojs/components'
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
import styles from './index.module.scss'

const gradeOptions = [
  '小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
  '初一', '初二', '初三', '高一', '高二', '高三',
]

const subjectOptions = [
  '语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治',
  '音乐', '美术', '少儿编程', '羽毛球', '篮球', '钢琴',
]

const goalOptions = ['0基础学新课', '巩固基础', '培优拔高']

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
  const [subject, setSubject] = useState<string[]>([])
  const [goal, setGoal] = useState('')
  const [location, setLocation] = useState('')
  const [timePicked, setTimePicked] = useState<string[]>([timeSlots[0]!])
  const [areaPicked, setAreaPicked] = useState<string[]>([districts[0]!])
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const budgetDirty = useRef(false)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // 预填个人资料里已填写的联系电话（选填）：已填则无需重复输入，代理人可直接联系
  useEffect(() => {
    callFunction<{ profile: { phone?: string } | null }>('getProfile', { role: 'parent' })
      .then((res) => {
        const p = res.profile
        if (p && p.phone) setPhone(p.phone)
      })
      .catch(() => {
        /* 读取失败不阻塞发布 */
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

  const handleSubjectChange = (v: string[]) => {
    setSubject(v)
    if (!budgetDirty.current && stage) {
      applyRefBudget(stage, v.some((x) => EXTRA_SUBJECTS.includes(x)))
    }
  }

  const budgetValid = !(budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax))
  // 联系电话为选填（微信审核要求不得强制索取）：填了则校验格式，未填可先发布，代理人后续通过微信与您确认
  const canSubmit = agreed && grade && subject.length > 0 && goal && location && budgetValid

  const submit = async () => {
    if (phone && !/^1\d{10}$/.test(phone)) {
      Taro.showToast({ title: '手机号需为 11 位数字且以 1 开头', icon: 'none' })
      return
    }
    const subjectMain = subject[0] || ''
    const category = MAIN_SUBJECTS.includes(subjectMain)
      ? '主科'
      : ['羽毛球', '篮球', '足球'].includes(subjectMain)
      ? '体育'
      : ['音乐', '美术', '钢琴'].includes(subjectMain)
      ? '艺术'
      : '编程'
    const payload = {
      grade,
      subject: subjectMain,
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
    try {
      await callFunction('createDemand', payload)
      Taro.redirectTo({ url: '/pages/publish-success/index' })
    } catch (err) {
      console.error('[Publish] 发布需求失败', err)
      Taro.showToast({ title: (err as Error)?.message || '发布失败，请重试', icon: 'none' })
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>发布需求</Text>
        <Text className={styles.headerTip}>填写孩子的基本信息，平台会匹配合适的老师</Text>
      </View>

      <View className={styles.card}>
        <SelectField
          label="孩子年级"
          value={grade}
          placeholder="请选择年级"
          options={gradeOptions}
          onChange={(v) => handleGradeChange(v as string)}
          required
        />
        <SelectField
          label="辅导科目（可多选）"
          value={subject}
          placeholder="请选择科目"
          options={subjectOptions}
          onChange={(v) => handleSubjectChange(v as string[])}
          required
          multiple
        />
        <SelectField
          label="辅导类型"
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
        <MultiPick label="上课区域（行政区 · 可多选）" options={districts} value={areaPicked} onChange={setAreaPicked} />

        <FieldLabel
          label="上课地点（精确到小区，必填）"
          hint="选择行政区后，请在此填写小区/地标与楼栋，便于老师判断通勤距离"
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

        <RiskNote>联系电话为选填，方便代理人第一时间联系您；未填写也可先发布，代理人会通过微信与您确认。</RiskNote>

        <FieldLabel
          label="预算范围（元/时）"
          hint={
            stage
              ? `已按「${stage}学段${subject.some((x) => EXTRA_SUBJECTS.includes(x)) ? ' · 兴趣特长类' : ' · 学科类'}」自动带入市场参考区间，可自行微调`
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

        <FieldLabel label="联系电话（选填）" hint="建议填写常用手机号，便于代理人快速与您对接；代理人仅用于对接，不会公开展示">
          <Input
            className={styles.input}
            type="number"
            maxlength={11}
            value={phone}
            placeholder={loadingProfile ? '读取个人资料中…' : '选填：请输入 11 位手机号'}
            placeholderClass={styles.placeholder}
            onInput={(e) => setPhone(onlyDigits(e.detail.value))}
          />
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

      <RiskNote>本平台仅做信息撮合、不代收课时费。老师的身份与学籍信息由平台代理人亲自人工核验，如发现信息不实，请立即联系代理人 Kiki，我们将承担责任并跟进处理。</RiskNote>

      <View className={styles.agreeRow} onClick={() => setAgreed(!agreed)}>
        <View className={styles.checkbox}>
          {agreed ? <Text className={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text className={styles.agreeText}>我已阅读并同意风险提示与隐私说明</Text>
      </View>

      <PrimaryButton onClick={submit} disabled={!canSubmit}>
        提交需求（提交即上架）
      </PrimaryButton>
    </View>
  )
}
