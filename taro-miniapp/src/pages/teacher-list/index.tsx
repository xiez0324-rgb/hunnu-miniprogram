import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callFunction } from '@/services/cloud'
import NavBar from '@/components/NavBar'
import TeacherCard from '@/components/TeacherCard'
import type { Applicant, Teacher } from '@/types'
import styles from './index.module.scss'

export default function TeacherListPage() {
  const [list, setList] = useState<Applicant[]>([])

  useEffect(() => {
    callFunction<{ teachers: Teacher[] }>('getTeachers').then((res) => {
      setList(res.teachers.map((t) => ({ ...t, recommended: false })))
    }).catch((err) => {
      console.error('[TeacherList] 获取老师失败', err)
    })
  }, [])

  const viewResume = (id: string) => {
    Taro.navigateTo({ url: `/pages/teacher-detail/index?id=${id}` })
  }

  return (
    <View className={styles.page}>
      <NavBar title="认证老师" onBack={() => Taro.navigateBack()} />

      {list.map((t, i) => (
        <TeacherCard
          key={t.id}
          applicant={t}
          index={i}
          onViewResume={() => viewResume(t.id)}
        />
      ))}

      <Text className={styles.tip}>点击「查看完整简历」了解老师，联系请发布需求，平台将为你匹配合适老师。</Text>
    </View>
  )
}
