import { View, Text, Textarea } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'
import AdminParentContact from '@/components/AdminParentContact'
import { callAdmin, guardAdminPage, invalidateAdminCache } from '@/services/admin'
import { fmtTime, statusColorClass, teacherCollegeMajorText } from '@/utils/adminFmt'
import type { OrderRow } from '@/types/admin'
import styles from './index.module.scss'

const FILTERS = ['全部', '待联系', '已联系', '已成交', '已取消', '已撤回'] as const
const PAGE_SIZE = 12
// 仅「未完成」的已发布订单可撤回（与云函数 adminWithdrawOrder 的校验口径一致）
const WITHDRAWABLE = ['待联系', '已联系']

function decodeStatus(v?: string): string {
  if (!v) return '全部'
  try {
    return decodeURIComponent(v)
  } catch (err) {
    return v
  }
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<string>(() => decodeStatus((router.params || {}).status) || '全部')
  const [list, setList] = useState<OrderRow[]>([])
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [busyId, setBusyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<{ row: OrderRow; to: string } | null>(null)
  // 撤回：二次确认 + 填写撤回原因
  const [withdrawing, setWithdrawing] = useState<OrderRow | null>(null)
  const [withdrawReason, setWithdrawReason] = useState('家长信息有误，平台撤回该订单')

  const load = useCallback(
    (force = false) => {
      if (force) invalidateAdminCache('adminListOrders')
      setLoading(true)
      setError('')
      callAdmin<{ list: OrderRow[] }>('adminListOrders', { status: filter })
        .then((r) => {
          setList(r.list || [])
          setLimit(PAGE_SIZE)
        })
        .catch((err) => {
          console.error('[AdminOrders] 加载失败', err)
          setError((err as Error).message)
        })
        .finally(() => {
          setLoading(false)
          Taro.stopPullDownRefresh()
        })
    },
    [filter]
  )

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

  const move = async (row: OrderRow, to: string) => {
    setPending(null)
    setBusyId(row.id)
    setError('')
    try {
      await callAdmin('adminUpdateOrder', { orderId: row.id, status: to })
      invalidateAdminCache('adminListOrders')
      invalidateAdminCache('adminDashboard')
      invalidateAdminCache('adminListDeliveries')
      setList((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: to } : r)))
      Taro.showToast({ title: `已${to}`, icon: 'success' })
    } catch (err) {
      console.error('[AdminOrders] 更新失败', err)
      setError((err as Error).message)
      Taro.showToast({ title: (err as Error).message || '操作失败', icon: 'none' })
    } finally {
      setBusyId('')
    }
  }

  const askMove = (row: OrderRow, to: string) => {
    setPending({ row, to })
  }

  // 撤回订单：仅未完成（待联系/已联系）可撤回；撤回后订单作废、需求整单下架、报名释放
  const withdraw = async (row: OrderRow, reason: string) => {
    if (busyId) return
    setBusyId(row.id)
    setError('')
    try {
      await callAdmin('adminWithdrawOrder', { orderId: row.id, reason: String(reason || '').trim() })
      invalidateAdminCache('adminListOrders')
      invalidateAdminCache('adminDashboard')
      invalidateAdminCache('adminListDeliveries')
      invalidateAdminCache('adminListDemands')
      setList((prev) =>
        filter === '全部'
          ? prev.map((r) => (r.id === row.id ? { ...r, status: '已撤回' } : r))
          : prev.filter((r) => r.id !== row.id),
      )
      setWithdrawing(null)
      Taro.showToast({ title: '已撤回，需求已下架并通知释放', icon: 'success' })
    } catch (err) {
      console.error('[AdminOrders] 撤回失败', err)
      setError((err as Error).message)
      Taro.showToast({ title: (err as Error).message || '撤回失败，请重试', icon: 'none' })
    } finally {
      setBusyId('')
    }
  }

  const confirmTextOf = (to: string): string => {
    const map: Record<string, string> = {
      已联系: '标记该订单为「已联系」？确认已与家长/老师完成首轮沟通。',
      已成交: '标记该订单为「已成交」？确认双方已正式确定家教关系。',
      已取消: '取消该订单？取消后家长需要重新确认人选。',
      待联系: '回退为「待联系」？请确认当前尚未正式联系。',
    }
    return map[to] || `确认将订单状态改为「${to}」？`
  }

  const openDetail = (row: OrderRow) => {
    Taro.navigateTo({ url: `/pages/admin/order-detail/index?orderId=${encodeURIComponent(row.id)}` })
  }

  const visible = list.slice(0, limit)

  return (
    <View className="admPage">
      <View className="admFilterBar">
        {FILTERS.map((f) => (
          <View
            key={f}
            className={`admChip ${filter === f ? 'admChipOn' : ''}`}
            onClick={() => {
              setFilter(f)
              setLimit(PAGE_SIZE)
            }}
          >
            <Text>{f === '全部' ? '全部订单' : f}</Text>
          </View>
        ))}
      </View>

      {error ? <Text className="admErrorText">{error}</Text> : null}
      {loading && list.length === 0 ? <View className="admLoadingBlock">加载中…</View> : null}
      {!loading && list.length === 0 && !error ? (
        <View className="admEmptyBlock">
          <Text>暂无该状态的订单</Text>
        </View>
      ) : null}

      {visible.map((row) => (
        <View key={row.id} className={styles.orderCard} onClick={() => openDetail(row)}>
          <View className={styles.rowTop}>
            <View style={{ display: 'flex', alignItems: 'center', gap: '12rpx', minWidth: 0 }}>
              <Text className={`admTag admTag${statusColorClass(row.status)}`}>{row.status}</Text>
              <Text className={styles.rowTitle}>
                {row.demand?.grade || ''} {row.demand?.subject || '?'} · {row.demand?.budget || '—'}
              </Text>
            </View>
            <Text className={styles.rowTime}>{fmtTime(row.confirmedAt || row.createTime)}</Text>
          </View>
          <View className={styles.rowLine}>
            <Text>🧑‍🏫 老师：{row.teacher?.name || '—'}
              {row.teacher?.verified ? '（已认证）' : ''}
              {row.teacher?.teacherNo ? ` · 编号 ${row.teacher.teacherNo}` : ''}
              {teacherCollegeMajorText(row.teacher) ? ` · ${teacherCollegeMajorText(row.teacher)}` : ''}</Text>
          </View>
          <View className={styles.rowLine}>
            <Text>📞 老师电话：{row.teacher?.phone || '—'}</Text>
          </View>
          <View className={styles.rowLine}>
            <Text>🧑‍🏠 家长：{row.parent?.nickname || '—'}</Text>
          </View>
          {/* 家长联系电话：列表视图即可直接拨打，无需进入详情 */}
          <AdminParentContact
            nickname={row.parent?.nickname}
            phone={row.parent?.phone}
          />
          <View className={styles.rowLine}>
            <Text>📍 {row.demand?.area || '—'} · 点击查看完整详情 →</Text>
          </View>

          <View className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
            {row.status === '待联系' ? (
              <>
                <View className="admBtn admBtnPrimary" onClick={() => askMove(row, '已联系')}>
                  <Text>标记已联系</Text>
                </View>
                <View className="admBtn admBtnGhost" onClick={() => askMove(row, '已取消')}>
                  <Text>取消订单</Text>
                </View>
              </>
            ) : null}
            {row.status === '已联系' ? (
              <>
                <View className="admBtn admBtnPrimary" onClick={() => askMove(row, '已成交')}>
                  <Text>标记已成交</Text>
                </View>
                <View className="admBtn admBtnAmber" onClick={() => askMove(row, '待联系')}>
                  <Text>回退待联系</Text>
                </View>
                <View className="admBtn admBtnGhost" onClick={() => askMove(row, '已取消')}>
                  <Text>取消订单</Text>
                </View>
              </>
            ) : null}
            {row.status === '已成交' ? (
              <View className="admBtn admBtnAmber" onClick={() => askMove(row, '已联系')}>
                <Text>回退为已联系</Text>
              </View>
            ) : null}
            {row.status === '已取消' ? (
              <View className="admBtn admBtnAmber" onClick={() => askMove(row, '待联系')}>
                <Text>恢复为待联系</Text>
              </View>
            ) : null}
            {WITHDRAWABLE.includes(row.status) ? (
              <View className="admBtn admBtnRed" onClick={() => setWithdrawing(row)}>
                <Text>撤回订单</Text>
              </View>
            ) : null}
            {busyId === row.id ? <Text className="admHint">处理中…</Text> : null}
          </View>
        </View>
      ))}

      {list.length > limit ? <Text className="admHint" style={{ textAlign: 'center', display: 'block' }}>上拉加载更多…</Text> : null}

      <ConfirmDialog
        visible={!!pending}
        title={`确认${pending?.to || ''}？`}
        content={pending ? confirmTextOf(pending.to) : ''}
        confirmText="确认操作"
        cancelText="再想想"
        onConfirm={() => {
          if (pending) move(pending.row, pending.to)
        }}
        onCancel={() => setPending(null)}
      />

      {/* 撤回订单：填写撤回原因（记录到操作日志） */}
      {withdrawing ? (
        <View className="admModalMask">
          <View className="admModal">
            <Text className="admModalTitle">撤回订单</Text>
            <Text className="admHint" style={{ marginBottom: '16rpx' }}>
              仅未完成订单可撤回。撤回后订单状态置「已撤回」，该家长需求单将整单下架隐藏，相关老师报名一并作废，并记录撤回时间与操作账号。
            </Text>
            <Textarea
              className="admTextarea"
              value={withdrawReason}
              maxlength={200}
              placeholder="请填写撤回原因（将写入操作日志）"
              onInput={(e) => setWithdrawReason(e.detail.value)}
            />
            <View className="admModalActions">
              <View className="admActionBtn">
                <View className="admBtn admBtnGhost" style={{ height: '88rpx' }} onClick={() => setWithdrawing(null)}>
                  <Text>取消</Text>
                </View>
              </View>
              <View className="admActionBtn">
                <View
                  className="admBtn admBtnDanger"
                  style={{ height: '88rpx' }}
                  onClick={() => withdraw(withdrawing, withdrawReason)}
                >
                  <Text>{busyId === withdrawing.id ? '撤回中…' : '确认撤回'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
