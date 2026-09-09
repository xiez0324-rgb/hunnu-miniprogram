import { View, Text, ScrollView, RootPortal } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import { useCallback, useEffect, useRef, useState } from 'react'
import { allSubjects, districts } from '@/data/shared'
import { callFunction } from '@/services/cloud'
import type { Demand } from '@/types'
import DemandCard from '@/components/DemandCard'
import styles from './index.module.scss'

const subjectOptions = ['全部', ...allSubjects, '其他']
const gradeOptions = ['不限', '小学', '初中', '高中']
const genderOptions = ['不限', '男', '女']
const areaOptions = ['不限', ...districts, '线上', '其他']
const sortOptions = ['综合排序', '距离排序', '报价排序']

type FilterKey = 'subject' | 'grade' | 'gender' | 'area' | 'sort'

function parseBudgetAvg(budget: string): number {
  const nums = budget.match(/\d+/g)?.map(Number) ?? []
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export default function Plaza() {
  const [subject, setSubject] = useState('全部')
  const [grade, setGrade] = useState('不限')
  const [gender, setGender] = useState('不限')
  const [area, setArea] = useState('不限')
  const [sort, setSort] = useState('综合排序')
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null)
  const [demands, setDemands] = useState<Demand[]>([])

  const fetchDemands = useCallback(() => {
    callFunction<{ demands: Demand[] }>('getDemands', { filter: '全部' }).then((res) => {
      setDemands(res.demands)
    }).catch((err) => {
      console.error('[Plaza] 获取需求失败', err)
    })
  }, [])

  useEffect(() => {
    fetchDemands()
  }, [fetchDemands])

  // 广场是常驻 tab 页：每次切回都刷新，保证刚发布的需求 / 报名人数实时更新。
  // 首次进入由上方 useEffect 拉取，这里跳过首次避免重复请求。
  const shownOnce = useRef(false)
  useDidShow(() => {
    if (!shownOnce.current) {
      shownOnce.current = true
      return
    }
    fetchDemands()
  })

  const stats = { active: 2, applied: 3, recommended: 2, done: 1 }

  const filterTabs: { key: FilterKey; label: string; value: string; options: string[]; state: string; setState: (v: string) => void }[] = [
    { key: 'sort', label: '排序', value: sort, options: sortOptions, state: sort, setState: setSort },
    { key: 'subject', label: '科目', value: subject, options: subjectOptions, state: subject, setState: setSubject },
    { key: 'grade', label: '年级', value: grade, options: gradeOptions, state: grade, setState: setGrade },
    { key: 'area', label: '区域', value: area, options: areaOptions, state: area, setState: setArea },
    { key: 'gender', label: '老师性别', value: gender, options: genderOptions, state: gender, setState: setGender },
  ]

  const currentTab = filterTabs.find((t) => t.key === openFilter)

  const filtered = demands.filter((d) => {
    if (subject !== '全部') {
      if (subject === '其他') {
        if (allSubjects.includes(d.subject)) return false
      } else if (d.subject !== subject) return false
    }
    if (grade !== '不限') {
      const match =
        grade === '小学' ? d.grade.includes('年级') : grade === '初中' ? d.grade.includes('初') : d.grade.includes('高')
      if (!match) return false
    }
    if (area !== '不限' && !d.area.includes(area)) return false
    // 老师性别：筛选「偏好男/女老师」，但需求标注「不限」时必须保留（只排除相反性别的偏好单）
    if (gender === '男' && d.gender === '女') return false
    if (gender === '女' && d.gender === '男') return false
    return true
  })

  const list = [...filtered].sort((a, b) => {
    if (sort === '报价排序') {
      return parseBudgetAvg(a.budget) - parseBudgetAvg(b.budget)
    }
    if (sort === '距离排序') {
      return a.area.localeCompare(b.area, 'zh-CN')
    }
    const aIsK12 = a.category === '主科'
    const bIsK12 = b.category === '主科'
    if (aIsK12 !== bIsK12) return aIsK12 ? 1 : -1
    return b.applicants - a.applicants
  })

  const openDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/demand-detail/index?id=${id}` })
  }

  return (
    <View className={styles.page}>
      {/* 问候 + 统计 */}
      <View className={styles.headerCard}>
        <Text className={styles.greet}>您好，张同学</Text>
        <Text className={styles.today}>
          今日新增 <Text className={styles.todayNum}>6</Text> 条需求，报名中 {stats.active} / 5
        </Text>
        <View className={styles.stats}>
          <View className={classnames(styles.statItem, styles.statMint)}>
            <Text className={styles.statNum}>{stats.applied}</Text>
            <Text className={styles.statLabel}>已报名</Text>
          </View>
          <View className={classnames(styles.statItem, styles.statSky)}>
            <Text className={styles.statNum}>{stats.recommended}</Text>
            <Text className={styles.statLabel}>已推荐</Text>
          </View>
          <View className={classnames(styles.statItem, styles.statAmber)}>
            <Text className={styles.statNum}>{stats.done}</Text>
            <Text className={styles.statLabel}>已成交</Text>
          </View>
        </View>
      </View>

      {/* 筛选栏 */}
      <ScrollView scrollX className={styles.filterBar}>
        {filterTabs.map((t) => {
          const isActive = t.value !== (t.key === 'sort' ? '综合排序' : t.key === 'subject' ? '全部' : '不限')
          const isOpen = openFilter === t.key
          return (
            <View
              key={t.key}
              className={classnames(styles.filterTab, (isActive || isOpen) && styles.filterTabActive)}
              onClick={() => setOpenFilter(isOpen ? null : t.key)}
            >
              <Text className={classnames(styles.filterTabText, (isActive || isOpen) && styles.filterTabTextActive)}>
                {isActive ? t.value : t.label}
              </Text>
              <Text className={classnames(styles.filterArrow, isOpen && styles.filterArrowOpen)}>▾</Text>
            </View>
          )
        })}
      </ScrollView>

      {/* 需求列表 */}
      <View className={styles.listWrap}>
        {list.length === 0 ? (
          <View className={styles.empty}>
            <Text className={styles.emptyIcon}>🍃</Text>
            <Text className={styles.emptyTitle}>暂时没有匹配的需求</Text>
            <Text className={styles.emptyDesc}>换个筛选条件看看吧</Text>
          </View>
        ) : (
          list.map((d: Demand) => (
            <DemandCard key={d.id} demand={d} onClick={() => openDetail(d.id)} />
          ))
        )}
      </View>

      {/* 筛选弹层 */}
      {openFilter && currentTab && (
        <RootPortal>
          <View className={styles.mask} onClick={() => setOpenFilter(null)}>
            <View className={styles.panel} onClick={(e) => e.stopPropagation()}>
              <ScrollView scrollY className={styles.panelList}>
                {currentTab.options.map((opt) => {
                  const selected = currentTab.state === opt
                  return (
                    <View
                      key={opt}
                      className={classnames(styles.panelOption, selected && styles.panelOptionSelected)}
                      onClick={() => {
                        currentTab.setState(opt)
                        setOpenFilter(null)
                      }}
                    >
                      <Text className={styles.panelOptionText}>{opt}</Text>
                      {selected && <Text className={styles.panelCheck}>✓</Text>}
                    </View>
                  )
                })}
              </ScrollView>
            </View>
          </View>
        </RootPortal>
      )}
    </View>
  )
}
