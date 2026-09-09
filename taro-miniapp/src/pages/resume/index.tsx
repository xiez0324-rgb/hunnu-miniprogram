import { View, Input, Textarea, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import { resumeSubjects } from '@/data/shared'
import { onlyDigits } from '@/utils'
import type { StageRates } from '@/types'
import NavBar from '@/components/NavBar'
import MultiPick from '@/components/MultiPick'
import FieldLabel from '@/components/FieldLabel'
import PrimaryButton from '@/components/PrimaryButton'
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
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchResume = useCallback(() => {
    callFunction<{ resume: any }>('getMyResume').then((res) => {
      const r = res.resume
      if (r) {
        setSubjects(r.subjects || [])
        setGrades(r.grades || [])
        setTimeSlots(r.timeSlots || [])
        setDistricts(Array.isArray(r.districts) ? r.districts.join('，') : r.districts || '')
        setRate(digitsOf(r.rate))
        if (r.rateByStage) {
          setStages(() => {
            const next: Record<keyof StageRates, StageInput> = {
              小学: { min: '', max: '' },
              初中: { min: '', max: '' },
              高中: { min: '', max: '' },
            }
            ;(Object.keys(r.rateByStage) as Array<keyof StageRates>).forEach((k) => {
              const v = r.rateByStage[k] as string
              const parts = String(v).split('-')
              next[k] = { min: (parts[0] || '').trim(), max: (parts[1] || '').trim() }
            })
            return next
          })
        }
        setIntro(r.intro || '')
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

  const validate = (): string | null => {
    if (!subjects.length) return '请至少选择一个授课科目'
    if (!grades.length) return '请至少选择一个可带年级'
    if (!timeSlots.length) return '请至少选择一个可授课时段'
    if (!districts.trim()) return '请填写可服务区域'
    if (!intro.trim()) return '请填写自我介绍'

    // 统一时薪：可填，纯数字且 20~600
    if (rate) {
      if (!/^\d+$/.test(rate)) return '统一时薪仅支持数字'
      const n = Number(rate)
      if (n < 20 || n > 600) return '统一时薪需在 20~600 元/时之间'
    }

    // 分学段区间：可整段不填；一旦填了其中一端则两端必填且需合法（min<=max，20~600）
    const hasStage = (Object.keys(stages) as Array<keyof StageRates>).some(
      (k) => stages[k].min || stages[k].max,
    )
    if (!rate && !hasStage) return '请填写统一时薪，或至少为一个学段配置薪资区间'

    for (const k of STAGES) {
      const { min, max } = stages[k]
      if (!min && !max) continue
      if (!min || !max) return `${k}档薪资区间不完整，请同时填写最低/最高时薪`
      if (!/^\d+$/.test(min) || !/^\d+$/.test(max)) return `${k}档薪资仅支持数字`
      const lo = Number(min)
      const hi = Number(max)
      if (lo < 20 || hi > 600) return `${k}档薪资需在 20~600 元/时之间`
      if (lo > hi) return `${k}档最低时薪不能高于最高时薪`
    }
    return null
  }

  const save = async () => {
    const msg = validate()
    if (msg) {
      Taro.showToast({ title: msg, icon: 'none' })
      return
    }
    setSaving(true)
    const rateByStage: StageRates = {}
    ;(Object.keys(stages) as Array<keyof StageRates>).forEach((k) => {
      const { min, max } = stages[k]
      if (min && max) rateByStage[k] = `${min}-${max}`
    })

    try {
      await callFunction('saveResume', {
        subjects,
        grades,
        timeSlots,
        rate,
        rateByStage: Object.keys(rateByStage).length ? rateByStage : null,
        districts: districts.split(/[，,]/).map((s) => s.trim()).filter(Boolean),
        intro,
      })
      Taro.showToast({ title: '简历已保存', icon: 'success' })
    } catch (err) {
      console.error('[Resume] 保存简历失败', err)
      Taro.showToast({ title: (err as Error)?.message || '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className={styles.page}>
      <NavBar title="简历管理" onBack={() => Taro.navigateBack()} />

      <View className={styles.card}>
        <MultiPick label="授课科目（多选）" options={resumeSubjects} value={subjects} onChange={setSubjects} />
        <MultiPick label="可带年级（多选）" options={['小学', '初中', '高中']} value={grades} onChange={setGrades} />
        <MultiPick label="可授课时段" options={['周一至周五晚', '周六全天', '周日全天']} value={timeSlots} onChange={setTimeSlots} />

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

        <FieldLabel label="自我介绍" hint="尽量写全：家教经历 + 提分效果，让家长更信任你">
          <Textarea
            className={styles.textarea}
            autoHeight
            value={intro}
            placeholder="如：带过 3 届中考冲刺，学员平均提分 20+，讲解耐心有方法。"
            placeholderClass={styles.placeholder}
            onInput={(e) => setIntro(e.detail.value)}
          />
        </FieldLabel>

        <PrimaryButton onClick={save} disabled={saving || !loaded}>
          {saving ? '保存中…' : '保存简历'}
        </PrimaryButton>
      </View>
    </View>
  )
}
