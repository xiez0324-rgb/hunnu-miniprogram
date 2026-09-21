import { View, Text } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { callAdmin, guardAdminPage, invalidateAdminCache } from '@/services/admin'
import AdminParentContact from '@/components/AdminParentContact'
import { fmtTime, statusColorClass } from '@/utils/adminFmt'
import type { OrderRow } from '@/types/admin'
import styles from './index.module.scss'

function Row({ k, v }: { k: string; v?: string }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <View className="admField">
      <Text className="admFieldKey">{k}</Text>
      <Text className="admFieldVal">{v}</Text>
    </View>
  )
}

export default function AdminOrderDetailPage() {
  const router = useRouter()
  const orderId = decodeURIComponent((router.params || {}).orderId || '')
  const [order, setOrder] = useState<OrderRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!orderId) return
    setLoading(true)
    setError('')
    callAdmin<{ list: OrderRow[] }>('adminListOrders', { status: '全部', orderId })
      .then((r) => setOrder((r.list && r.list[0]) || null))
      .catch((err) => {
        console.error('[AdminOrderDetail] 加载失败', err)
        setError((err as Error).message)
      })
      .finally(() => setLoading(false))
  }, [orderId])

  useEffect(() => {
    if (!guardAdminPage()) return
    load()
    // 离开时清除该列表缓存，保证返回订单列表能拉到最新
    return () => invalidateAdminCache('adminListOrders')
  }, [load])

  const d = order?.demand
  const t = order?.teacher
  const p = order?.parent

  return (
    <View className="admPage">
      <View className="admCard">
        {loading ? <View className="admLoadingBlock">加载中…</View> : null}
        {error ? <Text className="admErrorText">{error}</Text> : null}
        {!loading && !order ? <View className="admEmptyBlock"><Text>未找到该订单（可能已被删除）</Text></View> : null}

        {order ? (
          <>
            <View className={styles.headRow}>
              <Text className={`admTag admTag${statusColorClass(order.status)}`}>{order.status}</Text>
              <Text className={styles.orderId}>订单号：{order.id}</Text>
            </View>
            {order.confirmedAt ? <Text className="admHint">家长确认于 {fmtTime(order.confirmedAt)}</Text> : null}

            <Text className="admSectionTitle">家长需求</Text>
            <View className="admField"><Text className="admFieldKey">学段科目</Text><Text className="admFieldVal">{d?.grade || '—'} {d?.subject || ''}</Text></View>
            <Row k="类别" v={d?.category} />
            <Row k="标题" v={d?.title} />
            <Row k="预算(元/时)" v={d?.budget} />
            <Row k="区域" v={d?.area} />
            <Row k="性别要求" v={d?.gender} />

            <Text className="admSectionTitle" style={{ marginTop: '24rpx' }}>老师</Text>
            <View className="admField">
              <Text className="admFieldKey">姓名</Text>
              <Text className="admFieldVal">{t?.name || '—'}{t?.verified ? '（已认证）' : ''}</Text>
            </View>
            <Row k="专属编号" v={t?.teacherNo} />
            <Row k="联系方式" v={t?.phone} />
            <Row k="学院" v={t?.college} />
            <Row k="专业" v={t?.major} />
            <Row k="可教科目" v={t?.subject} />
            <Row k="期望时薪" v={t?.rate ? `${t.rate} 元/时` : undefined} />

            {/* 家长联系电话：详情视图完整展示，支持一键拨打 / 复制，便于随时联系家长 */}
            <View style={{ marginTop: '24rpx' }}>
              <AdminParentContact
                variant="card"
                nickname={p?.nickname}
                phone={p?.phone}
                wechat={p?.wechat}
                area={p?.area}
              />
            </View>

            <Text className="admHint" style={{ display: 'block', marginTop: '24rpx' }}>
              创建时间：{fmtTime(order.createTime)}
            </Text>
            {order.cancelTime ? (
              <Text className="admHint" style={{ display: 'block' }}>取消时间：{fmtTime(order.cancelTime)}</Text>
            ) : null}
            <Text className="admHint" style={{ display: 'block' }}>需求单号：{d?.id || order.demandId || '—'}</Text>
          </>
        ) : null}
      </View>
      {order && order.status === '待联系' ? (
        <Text className="admHint">提示：返回「订单管理」可推进联系 / 成交 / 取消等状态。</Text>
      ) : null}
    </View>
  )
}
