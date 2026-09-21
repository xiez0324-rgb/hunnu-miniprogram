import { View, Text, Textarea } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'
import AdminParentContact from '@/components/AdminParentContact'
import { callAdmin, guardAdminPage, invalidateAdminCache } from '@/services/admin'
import { fmtAmount, fmtTime, statusColorClass } from '@/utils/adminFmt'
import type { DemandRow } from '@/types/admin'
import styles from './index.module.scss'

const PAGE_SIZE = 12

function decodeStatus(v?: string): string | undefined {
  if (!v) return undefined
  try {
    return decodeURIComponent(v)
  } catch (err) {
    return v
  }
}

function Row({ k, v }: { k: string; v?: string }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <View className="admField">
      <Text className="admFieldKey">{k}</Text>
      <Text className="admFieldVal">{v}</Text>
    </View>
  )
}

export default function AdminDemandsPage() {
  const router = useRouter()
  const [status] = useState<string | undefined>(() => decodeStatus((router.params || {}).status))
  const [auditStatus] = useState<string | undefined>(() => decodeStatus((router.params || {}).audit))
  const [list, setList] = useState<DemandRow[]>([])
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<DemandRow | null>(null)
  const [busyId, setBusyId] = useState('')
  const [confirming, setConfirming] = useState<DemandRow | null>(null)
  const [rejecting, setRejecting] = useState<DemandRow | null>(null)
  const [rejectReason, setRejectReason] = useState('内容不符合平台录入规范，请修改后重新提交')

  const load = useCallback((force = false) => {
    if (force) invalidateAdminCache('adminListDemands')
    setLoading(true)
    setError('')
    const params: Record<string, unknown> = {}
    if (status && status !== '全部') params.status = status
    if (auditStatus && auditStatus !== '全部') params.auditStatus = auditStatus
    callAdmin<{ list: DemandRow[] }>('adminListDemands', params)
      .then((r) => {
        setList(r.list || [])
        setLimit(PAGE_SIZE)
      })
      .catch((err) => {
        console.error('[AdminDemands] 加载失败', err)
        setError((err as Error).message)
      })
      .finally(() => {
        setLoading(false)
        Taro.stopPullDownRefresh()
      })
  }, [status, auditStatus])

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

  // 先审后发：审核通过后需求才会在需求广场对老师展示
  const review = async (row: DemandRow, action: '通过' | '驳回', reason = '') => {
    if (busyId) return
    if (action === '驳回' && !String(reason || '').trim()) {
      Taro.showToast({ title: '请填写驳回原因', icon: 'none' })
      return
    }
    setBusyId(row.id)
    setError('')
    try {
      await callAdmin('adminReviewDemand', {
        demandId: row.id,
        action,
        rejectReason: action === '驳回' ? reason : '',
      })
      invalidateAdminCache('adminListDemands')
      invalidateAdminCache('adminDashboard')
      setList((prev) => prev.map((d) => (d.id === row.id ? { ...d, auditStatus: action === '通过' ? '已通过' : '已驳回' } : d)))
      setConfirming(null)
      setRejecting(null)
      setSelected(null)
      Taro.showToast({ title: action === '通过' ? '已通过，需求广场可见' : '已驳回', icon: 'success' })
    } catch (err) {
      console.error('[AdminDemands] 审核失败', err)
      Taro.showToast({ title: (err as Error).message || '审核失败，请重试', icon: 'none' })
    } finally {
      setBusyId('')
    }
  }

  return (
    <View className="admPage">
      <View className="admHeaderRow">
        <Text className="admHint">
          需求单明细
          {status && status !== '全部' ? `（${status}）` : ''}
          {auditStatus && auditStatus !== '全部' ? `（审核：${auditStatus}）` : ''}
          {' '}· 共 {list.length} 条
        </Text>
      </View>
      {error ? <Text className="admErrorText">{error}</Text> : null}
      {loading && list.length === 0 ? <View className="admLoadingBlock">加载中…</View> : null}
      {!loading && list.length === 0 && !error ? (
        <View className="admEmptyBlock">
          <Text>暂无需求单</Text>
        </View>
      ) : null}

      {visible.map((d) => (
        <View key={d.id} className="admCard admCardLink" onClick={() => setSelected(d)}>
          <View className="admCardHeader">
            <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx', minWidth: 0, flex: 1 }}>
              <Text className="admCardTitle">
                {d.grade || ''} {d.subject || '?'} · {d.budget ? `${fmtAmount(d.budget)} 元/时` : '预算待定'}
              </Text>
            </View>
            {d.auditStatus ? (
              <Text className={`admTag ${d.auditStatus === '待审核' ? 'admTagAmber' : d.auditStatus === '已驳回' ? 'admTagRed' : 'admTagGreen'}`}>
                {d.auditStatus}
              </Text>
            ) : null}
            {d.status ? <Text className={`admTag admTag${statusColorClass(d.status)}`}>{d.status}</Text> : null}
          </View>
          <Text className={styles.demandMeta}>
            📍 {d.area || '—'} · 👤 {d.parent?.nickname || '—'} · {d.applicants ?? 0} 位老师报名
          </Text>
          {/* 家长联系电话：列表视图即可直接联系家长（审核/催办核对） */}
          <AdminParentContact
            nickname={d.parent?.nickname}
            phone={d.parent?.phone}
          />
          {d.createTime ? <Text className={styles.demandMeta}>提交于 {fmtTime(d.createTime)}</Text> : null}
        </View>
      ))}

      {list.length > limit ? <Text className="admHint" style={{ display: 'block', textAlign: 'center' }}>上拉加载更多…</Text> : null}

      {selected ? (
        <View className="admModalMask admModalCenter" onClick={() => setSelected(null)}>
          <View className="admModal admModalRound" onClick={(e) => e.stopPropagation()}>
            <Text className="admModalTitle">需求单详情</Text>
            <Row k="需求单号" v={selected.id} />
            <Row k="审核状态" v={selected.auditStatus} />
            <Row k="状态" v={selected.status} />
            <Row k="学段科目" v={`${selected.grade || '—'} ${selected.subject || ''}`} />
            <Row k="类别" v={selected.category} />
            <Row k="标题" v={selected.title} />
            <Row k="预算(元/时)" v={selected.budget ? fmtAmount(selected.budget) : undefined} />
            <Row k="区域" v={selected.area} />
            <Row k="性别要求" v={selected.gender} />
            <Row k="服务时段" v={selected.classTime} />
            <Row k="报名老师" v={selected.applicants != null ? `${selected.applicants} 位` : undefined} />
            <Row k="创建时间" v={fmtTime(selected.createTime)} />
            {selected.desc ? <Text className={styles.descText}>📝 {selected.desc}</Text> : null}

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
              {selected.auditStatus === '待审核' ? (
                <View className="admActionBtn">
                  <View className="admBtn admBtnPrimary" style={{ height: '88rpx' }} onClick={() => setConfirming(selected)}>
                    <Text>{busyId === selected.id ? '处理中…' : '审核通过'}</Text>
                  </View>
                </View>
              ) : null}
              {selected.auditStatus === '待审核' ? (
                <View className="admActionBtn">
                  <View className="admBtn admBtnRed" style={{ height: '88rpx' }} onClick={() => setRejecting(selected)}>
                    <Text>驳回</Text>
                  </View>
                </View>
              ) : null}
              <View className="admActionBtn">
                <View className="admBtn admBtnGhost" style={{ height: '88rpx' }} onClick={() => setSelected(null)}>
                  <Text>关闭</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {/* 通过：二次确认 */}
      <ConfirmDialog
        visible={!!confirming}
        title="确认审核通过？"
        content={`通过后需求单「${confirming?.id || ''}」将在需求广场对老师展示，可被报名。请确认内容真实、合规。`}
        confirmText="确认通过"
        cancelText="再核对"
        onConfirm={() => {
          if (confirming) review(confirming, '通过')
        }}
        onCancel={() => setConfirming(null)}
      />

      {/* 驳回：填写原因 */}
      {rejecting ? (
        <View className="admModalMask">
          <View className="admModal">
            <Text className="admModalTitle">驳回需求单</Text>
            <Text className="admHint" style={{ marginBottom: '16rpx' }}>
              驳回后该需求不会在需求广场展示；原因将记录在审核日志中，便于家长修改后重新提交。
            </Text>
            <Textarea
              className="admTextarea"
              value={rejectReason}
              maxlength={200}
              onInput={(e) => setRejectReason(e.detail.value)}
            />
            <View className="admModalActions">
              <View className="admActionBtn">
                <View className="admBtn admBtnGhost" style={{ height: '88rpx' }} onClick={() => setRejecting(null)}>
                  <Text>取消</Text>
                </View>
              </View>
              <View className="admActionBtn">
                <View
                  className="admBtn admBtnDanger"
                  style={{ height: '88rpx' }}
                  onClick={() => review(rejecting, '驳回', rejectReason.trim())}
                >
                  <Text>{busyId === rejecting.id ? '提交中…' : '确认驳回'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
