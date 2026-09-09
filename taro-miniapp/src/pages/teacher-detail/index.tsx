import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import NavBar from '@/components/NavBar'
import VerifyTag from '@/components/VerifyTag'
import RiskNote from '@/components/RiskNote'
import EmptyState from '@/components/EmptyState'
import { teacherCollegeMajorText } from '@/utils'
import type { Teacher, Resume } from '@/types'
import styles from './index.module.scss'

export default function TeacherDetailPage() {
  const router = useRouter()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [resume, setResume] = useState<Resume | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const teacherId = router.params.id || 't1'
    setLoaded(false)
    callFunction<{ teacher: Teacher | null; resume: Resume | null }>('getTeacherDetail', { teacherId }).then((res) => {
      setTeacher(res.teacher)
      setResume(res.resume)
      setLoaded(true)
    }).catch((err) => {
      console.error('[TeacherDetail] 获取老师失败', err)
      setLoaded(true)
    })
  }, [router.params.id])

  // 加载中：仅显示导航栏
  if (!loaded) {
    return (
      <View className={styles.page}>
        <NavBar title="老师简历" onBack={() => Taro.navigateBack()} />
      </View>
    )
  }

  // 查无老师：友好空态（避免白屏）
  if (!teacher) {
    return (
      <View className={styles.page}>
        <NavBar title="老师简历" onBack={() => Taro.navigateBack()} />
        <EmptyState
          icon="📄"
          title="暂无该老师资料"
          desc="该老师可能已下架资料或未完成入驻，可联系平台代理人了解更多。"
        />
      </View>
    )
  }

  // 老师存在但简历未完善：展示基础信息 + 友好提示，而非白屏
  if (!resume) {
    return (
      <View className={styles.page}>
        <NavBar title="老师简历" onBack={() => Taro.navigateBack()} />
        <View className={styles.headCard}>
          <View className={styles.avatarA}>
            <Text className={styles.avatarText}>{teacher.name.slice(0, 1)}</Text>
          </View>
          <View className={styles.info}>
            <View className={styles.nameRow}>
              <Text className={styles.name}>{teacher.name} 老师</Text>
              <VerifyTag verified={teacher.verified} />
            </View>
            <Text className={styles.meta}>{teacherCollegeMajorText(teacher) || '在读大学生'}</Text>
            <Text className={styles.meta}>{teacher.subject} · {teacher.meta}</Text>
          </View>
        </View>
        <View className={styles.card}>
          <Text className={styles.cardTitle}>✍️ 自我介绍</Text>
          <Text className={styles.intro}>
            {teacher.quote || '该老师尚未完善在线简历，可联系平台代理人获取更多信息。'}
          </Text>
        </View>
        <RiskNote>请通过发布需求或确认人选的方式联系老师，联系方式由平台代理人对接，勿在平台外私下交易。</RiskNote>
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <NavBar title="老师简历" onBack={() => Taro.navigateBack()} />

      {/* 老师信息头 */}
      <View className={styles.headCard}>
        <View className={styles.avatarA}>
          <Text className={styles.avatarText}>{teacher.name.slice(0, 1)}</Text>
        </View>
        <View className={styles.info}>
          <View className={styles.nameRow}>
            <Text className={styles.name}>{teacher.name} 老师</Text>
            <VerifyTag verified={teacher.verified} />
          </View>
          <Text className={styles.meta}>{teacherCollegeMajorText(teacher) || '在读大学生'}</Text>
          <Text className={styles.meta}>{teacher.subject} · {teacher.meta}</Text>
        </View>
      </View>

      {/* 完整简历 */}
      <View className={styles.card}>
        <Text className={styles.cardTitle}>📋 授课信息</Text>
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>可授课科目</Text>
          <View className={styles.chipRow}>
            {resume.subjects.map((s) => (
              <Text key={s} className={styles.chipStatic}>{s}</Text>
            ))}
          </View>
        </View>
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>可带年级</Text>
          <View className={styles.chipRow}>
            {resume.grades.map((g) => (
              <Text key={g} className={styles.chipStatic}>{g}</Text>
            ))}
          </View>
        </View>
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>可授课时段</Text>
          <View className={styles.chipRow}>
            {resume.timeSlots.map((t) => (
              <Text key={t} className={styles.chipStatic}>{t}</Text>
            ))}
          </View>
        </View>
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>可服务区域</Text>
          <View className={styles.chipRow}>
            {resume.districts.map((d) => (
              <Text key={d} className={styles.chipStatic}>{d}</Text>
            ))}
          </View>
        </View>
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>期望时薪</Text>
          {resume.rateByStage && Object.keys(resume.rateByStage).length > 0 ? (
            <View>
              {Object.entries(resume.rateByStage).map(([stage, range]) => (
                <Text key={stage} className={styles.valueLine}>
                  {stage} {range} 元/时
                </Text>
              ))}
            </View>
          ) : (
            <Text className={styles.value}>
              {resume.rate.includes('元') ? resume.rate : `${resume.rate} 元/时`}
            </Text>
          )}
        </View>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>✍️ 自我介绍</Text>
        <Text className={styles.intro}>{resume.intro}</Text>
      </View>

      <RiskNote>请通过发布需求或确认人选的方式联系老师，联系方式由平台代理人对接，勿在平台外私下交易。</RiskNote>
    </View>
  )
}
