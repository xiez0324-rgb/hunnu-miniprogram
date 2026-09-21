import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { callAdmin, guardAdminPage, invalidateAdminCache } from '@/services/admin'
import AdminParentContact from '@/components/AdminParentContact'
import { fmtTime, statusColorClass, teacherCollegeMajorText } from '@/utils/adminFmt'
import type { ApplicationRow } from '@/types/admin'
import styles from './index.module.scss'

const PAGE_SIZE = 12

function Row({ k, v }: { k: string; v?: string }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <View className="admField">
      <Text className="admFieldKey">{k}</Text>
      <Text className="admFieldVal">{v}</Text>
    </View>
  )
}

export default function AdminApplicationsPage() {
  const [list, setList] = useState<ApplicationRow[]>([])
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ApplicationRow | null>(null)

  const load = useCallback((force = false) => {
    if (force) invalidateAdminCache('adminListApplications')
    setLoading(true)
    setError('')
    callAdmin<{ list: ApplicationRow[] }>('adminListApplications')
      .then((r) => {
        setList(r.list || [])
        setLimit(PAGE_SIZE)
      })
      .catch((err) => {
        console.error('[AdminApplications] 加载失败', err)
        setError((err as Error).message)
      })
      .finally(() => {
        setLoading(false)
        Taro.stopPullDownRefresh()
      })
  }, [])

  useEffect(() => {
    if (!guardAdminPage()) return
    load()
  }, [load])

  usePullDownRefresh(() => {
    load(true)
  })

  useReachBottom(() => {
    setLimit((l) => l + PAGE_SIZE)
  })

  const visible = list.slice(0, limit)

  return (
    <View className="admPage">
      <View className="admHeaderRow">
        <Text className="admHint">老师报名明细 · 共 {list.length} 条</Text>
      </View>
      {error ? <Text className="admErrorText">{error}</Text> : null}
      {loading && list.length === 0 ? <View className="admLoadingBlock">加载中…</View> : null}
      {!loading && list.length === 0 && !error ? (
        <View className="admEmptyBlock">
          <Text>暂无报名记录</Text>
        </View>
      ) : null}

      {visible.map((a) => (
        <View key={a.id} className="admCard admCardLink" onClick={() => setSelected(a)}>
          <View className="admCardHeader">
            <Text className="admCardTitle">
              🧑‍🏫 {a.teacher?.name || '—'}
              {a.verified ? '（已认证）' : ''}
              {teacherCollegeMajorText(a.teacher) ? ` · ${teacherCollegeMajorText(a.teacher)}` : ''}
            </Text>
            {a.status ? <Text className={`admTag admTag${statusColorClass(a.status)}`}>{a.status}</Text> : null}
          </View>
          <Text className={styles.meta}>
            报名需求：{a.demand?.grade || ''} {a.demand?.subject || '?'} · {a.demand?.budget ? `${a.demand.budget} 元/时` : '—'} · {a.demand?.area || ''}
          </Text>
          {/* 家长联系电话：报名所属需求单的家长，列表视图即可直接联系 */}
          <AdminParentContact nickname={a.parent?.nickname} phone={a.parent?.phone} />
          {a.createTime ? <Text className={styles.meta}>报名于 {fmtTime(a.createTime)} · 点击查看详情 →</Text> : null}
        </View>
      ))}

      {list.length > limit ? <Text className="admHint" style={{ display: 'block', textAlign: 'center' }}>上拉加载更多…</Text> : null}

      {selected ? (
        <View className="admModalMask admModalCenter" onClick={() => setSelected(null)}>
          <View className="admModal admModalRound" onClick={(e) => e.stopPropagation()}>
            <Text className="admModalTitle">报名详情</Text>
            <Text className="admSectionTitle">老师</Text>
            <Row k="姓名" v={`${selected.teacher?.name || '—'}${selected.verified ? '（已认证）' : ''}`} />
            <Row k="专属编号" v={selected.teacher?.teacherNo} />
            <Row k="联系电话" v={selected.teacher?.phone} />
            <Row k="学院" v={selected.teacher?.college} />
            <Row k="专业" v={selected.teacher?.major} />
            <Row k="科目" v={selected.teacher?.subject} />
            <Row k="状态" v={selected.status} />
            <Row k="期望时薪" v={selected.rate ? `${selected.rate} 元/时` : undefined} />
            <Row k="报名时间" v={fmtTime(selected.createTime)} />

            <Text className="admSectionTitle" style={{ marginTop: '24rpx' }}>对应需求</Text>
            <Row k="科目" v={`${selected.demand?.grade || ''} ${selected.demand?.subject || '?'}`} />
            <Row k="预算" v={selected.demand?.budget ? `${selected.demand.budget} 元/时` : undefined} />
            <Row k="区域" v={selected.demand?.area} />
            <Row k="标题" v={selected.demand?.title} />

            {/* 家长联系电话：详情视图完整展示，支持一键拨打 / 复制 */}
            <View style={{ marginTop: '24rpx' }}>
              <AdminParentContact
                variant="card"
                nickname={selected.parent?.nickname}
                phone={selected.parent?.phone}
                wechat={selected.parent?.wechat}
                area={selected.parent?.area}
              />
            </View>

            <View className="admModalActions">
              <View className="admActionBtn">
                <View className="admBtn admBtnGhost" style={{ height: '88rpx' }} onClick={() => setSelected(null)}>
                  <Text>关闭</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
