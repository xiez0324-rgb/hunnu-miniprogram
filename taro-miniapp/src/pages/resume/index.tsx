import { View, Input, Textarea, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import { resumeSubjects } from '@/data/shared'
import { onlyDigits } from '@/utils'
import {
  TEACHING_YEAR_OPTIONS,
  joinList,
  normalizeResume,
  resumeMissingFields,
  splitList,
  validateResumeSpec,
} from '@/utils/teacherProfile'
import type { StageRates } from '@/types'
import NavBar from '@/components/NavBar'
import MultiPick from '@/components/MultiPick'
import SelectField from '@/components/SelectField'
import FieldLabel from '@/components/FieldLabel'
import PrimaryButton from '@/components/PrimaryButton'
import PlatformRecordNotice from '@/components/PlatformRecordNotice'
import styles from './index.module.scss'

const STAGES: Array<keyof StageRates> = ['小学', '初中', '高中']

// 从展示文本（可能带 "元/时"）中提取纯数字
function digitsOf(value?: string): string {
  return (value || '').replace(/[^\d-]/g, '').replace(/-$/, '')
}

interface StageInput {
  min: string
  max: string
}

export default function ResumePage() {
  const [subjects, setSubjects] = useState<string[]>(['数学'])
  const [grades, setGrades] = useState<string[]>(['初中'])
  const [timeSlots, setTimeSlots] = useState<string[]>(['周六全天'])
  const [districts, setDistricts] = useState('岳麓区')
  const [rate, setRate] = useState('120')
  const [stages, setStages] = useState<Record<keyof StageRates, StageInput>>({
    小学: { min: '', max: '' },
    初中: { min: '', max: '' },
    高中: { min: '', max: '' },
  })
  const [intro, setIntro] = useState('')
  // 教学经历（与家长端「教学经历」一一对应）：教龄 / 工作经历 / 资质证书
  const [teachingYears, setTeachingYears] = useState('')
  const [experience, setExperience] = useState('')
  const [certificates, setCertificates] = useState('')
  // 基础身份信息（性别 / 认证编号）：只读展示，来源于个人档案与实名认证
  const [profile, setProfile] = useState<{ gender?: string; teacherNo?: string }>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchResume = useCallback(() => {
    callFunction<{ resume: any; profile?: { gender?: string; teacherNo?: string } }>('getMyResume').then((res) => {
      // 与家长端共用同一套归一化规则，保证回填内容与家长看到的一致
      const r = normalizeResume(res.resume)
      setProfile(res.profile || {})
      if (res.resume) {
        setSubjects(r.subjects)
        setGrades(r.grades)
        setTimeSlots(r.timeSlots)
        setDistricts(joinList(r.districts))
        setRate(digitsOf(r.rate))
        setTeachingYears(r.teachingYears)
        setExperience(r.experience)
        setCertificates(joinList(r.certificates))
        const rbs = r.rateByStage
        if (rbs) {
          setStages(() => {
            const next: Record<keyof StageRates, StageInput> = {
              小学: { min: '', max: '' },
              初中: { min: '', max: '' },
              高中: { min: '', max: '' },
            }
            ;(Object.keys(rbs) as Array<keyof StageRates>).forEach((k) => {
              const parts = String(rbs[k] || '').split('-')
              next[k] = { min: (parts[0] || '').trim(), max: (parts[1] || '').trim() }
            })
            return next
          })
        }
        setIntro(r.intro)
      }
      setLoaded(true)
    }).catch((err) => {
      console.error('[Resume] 读取简历失败', err)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    fetchResume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchResume])

  const setStageVal = (stage: keyof StageRates, key: 'min' | 'max', value: string) => {
    setStages((prev) => ({
      ...prev,
      [stage]: { ...prev[stage], [key]: value },
    }))
  }

  // 组装提交体：老师端与家长端展示用的字段一一对应，避免出现「录入但未提交」的字段
  const buildPayload = () => {
    const rateByStage: StageRates = {}
    ;(Object.keys(stages) as Array<keyof StageRates>).forEach((k) => {
      const { min, max } = stages[k]
      if (min && max) rateByStage[k] = `${min}-${max}`
    })
    return {
      subjects,
      grades,
      timeSlots,
      rate,
      rateByStage,
      districts: splitList(districts),
      teachingYears: teachingYears.trim(),
      experience: experience.trim(),
      certificates: splitList(certificates),
      intro: intro.trim(),
    }
  }

  // 规则统一由 @/utils/teacherProfile 的 validateResumeSpec 提供（与云函数写入校验一致）
  const validate = (): string | null => validateResumeSpec(buildPayload())

  const save = async () => {
    const msg = validate()
    if (msg) {
      Taro.showToast({ title: msg, icon: 'none' })
      return
    }
    setSaving(true)
    const payload = buildPayload()

    try {
      await callFunction('saveResume', {
        ...payload,
        rateByStage: Object.keys(payload.rateByStage).length ? payload.rateByStage : null,
      })
      Taro.showToast({ title: '简历已保存', icon: 'success' })
    } catch (err) {
      console.error('[Resume] 保存简历失败', err)
      Taro.showToast({ title: (err as Error)?.message || '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  // 两端同步自检：家长端会展示但当前尚未填写的字段
  const missing = loaded ? resumeMissingFields(buildPayload(), profile.gender) : []

  return (
    <View className={styles.page}>
      <NavBar title="简历管理" onBack={() => Taro.navigateBack()} />

      <View className={styles.card}>
        <View className={styles.baseInfo}>
          <Text className={styles.baseInfoItem}>性别：{profile.gender || '未填写'}</Text>
          <Text className={styles.baseInfoItem}>认证编号：{profile.teacherNo || '未认证'}</Text>
        </View>

        {/* 合规提示：平台为信息的唯一收集者与发布者 */}
        <PlatformRecordNotice desc="您填写的简历信息由平台统一录入、核验后展示，您不会直接对外发布任何内容。" />

        <MultiPick label="服务科目（多选）" options={resumeSubjects} value={subjects} onChange={setSubjects} />
        <MultiPick label="服务年级（多选）" options={['小学', '初中', '高中']} value={grades} onChange={setGrades} />
        <MultiPick label="可服务时段" options={['周一至周五晚', '周六全天', '周日全天']} value={timeSlots} onChange={setTimeSlots} />

        <FieldLabel label="统一时薪（元/时）" hint="兼容原方式：按单一价格接单；可留空，改用下方分档">
          <Input
            className={styles.input}
            type="number"
            value={rate}
            placeholder="如 120"
            placeholderClass={styles.placeholder}
            onInput={(e) => setRate(onlyDigits(e.detail.value))}
          />
        </FieldLabel>

        <FieldLabel label="分学段时薪区间（元/时）" hint="为不同学段分别设置区间，如 小学 50-60、初中 70-80；留空该学段表示按统一时薪">
          {STAGES.map((stage) => (
            <View key={stage} className={styles.stageRow}>
              <Text className={styles.stageLabel}>{stage}</Text>
              <Input
                className={styles.stageInput}
                type="number"
                value={stages[stage].min}
                placeholder="最低"
                placeholderClass={styles.placeholder}
                onInput={(e) => setStageVal(stage, 'min', onlyDigits(e.detail.value))}
              />
              <Text className={styles.stageSep}>—</Text>
              <Input
                className={styles.stageInput}
                type="number"
                value={stages[stage].max}
                placeholder="最高"
                placeholderClass={styles.placeholder}
                onInput={(e) => setStageVal(stage, 'max', onlyDigits(e.detail.value))}
              />
            </View>
          ))}
        </FieldLabel>

        <FieldLabel label="可服务区域" hint="多个区域用逗号分隔，如：岳麓区，芙蓉区">
          <Input
            className={styles.input}
            value={districts}
            placeholder="如：岳麓区 · 麓山名园"
            placeholderClass={styles.placeholder}
            onInput={(e) => setDistricts(e.detail.value)}
          />
        </FieldLabel>

        {/* 教学经历：与家长端「教学经历」卡片一一对应 */}
        <SelectField
          label="教龄"
          value={teachingYears}
          placeholder="请选择您的家教/教学年限"
          options={TEACHING_YEAR_OPTIONS}
          onChange={(v) => setTeachingYears(String(v))}
        />

        <FieldLabel label="工作经历" hint="家教/教学经历，如：带过 3 届中考冲刺，学员平均提分 20+">
          <Textarea
            className={styles.textarea}
            autoHeight
            maxlength={300}
            value={experience}
            placeholder="如：2023 年至今带初三数学，累计带过 5 名学生，平均提分 20+。"
            placeholderClass={styles.placeholder}
            onInput={(e) => setExperience(e.detail.value)}
          />
        </FieldLabel>

        <FieldLabel label="资质证书" hint="多项用顿号或逗号分隔，如：英语专八、教师资格证">
          <Input
            className={styles.input}
            value={certificates}
            placeholder="如：英语专八、教师资格证"
            placeholderClass={styles.placeholder}
            onInput={(e) => setCertificates(e.detail.value)}
          />
        </FieldLabel>

        <FieldLabel label="自我介绍" hint="尽量写全：家教经历 + 提分效果，让家长更信任你">
          <Textarea
            className={styles.textarea}
            autoHeight
            maxlength={500}
            value={intro}
            placeholder="如：带过 3 届中考冲刺，学员平均提分 20+，讲解耐心有方法。"
            placeholderClass={styles.placeholder}
            onInput={(e) => setIntro(e.detail.value)}
          />
        </FieldLabel>

        {/* 两端同步自检：家长端会展示但尚未填写的字段，提示老师补齐避免展示偏差 */}
        {missing.length > 0 ? (
          <View className={styles.completeness}>
            <Text className={styles.completenessTitle}>⚠️ 资料待补齐（家长端会展示以下内容）</Text>
            <View className={styles.completenessChips}>
              {missing.map((m) => (
                <Text key={m} className={styles.completenessChip}>{m}</Text>
              ))}
            </View>
            <Text className={styles.completenessHint}>
              带 * 的内容需填写完整；「性别」请在「我的 → 个人信息」中填写。
            </Text>
          </View>
        ) : (
          <View className={styles.completenessOk}>
            <Text className={styles.completenessOkText}>✅ 资料完整，家长端展示内容已与您的填写一致</Text>
          </View>
        )}

        <PrimaryButton onClick={save} disabled={saving || !loaded}>
          {saving ? '保存中…' : '保存简历'}
        </PrimaryButton>
      </View>
    </View>
  )
}
