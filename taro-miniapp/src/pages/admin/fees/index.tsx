import { View, Text, Input } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { callAdmin, guardAdminPage, invalidateAdminCache } from '@/services/admin'
import { calcModeLabel, fmtAmount, fmtTime, statusColorClass } from '@/utils/adminFmt'
import type { FeeRow } from '@/types/admin'
import styles from './index.module.scss'

type Mode = 'none' | 'feeAmount' | 'percent'

interface EditState {
  orderId: string
  totalFee: string
  mode: Mode
  value: string
  status: string
}

const emptyEdit = (orderId = ''): EditState => ({ orderId, totalFee: '', mode: 'none', value: '', status: '待付' })

export default function AdminFeesPage() {
  const [list, setList] = useState<FeeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newOrderId, setNewOrderId] = useState('')
  const [edit, setEdit] = useState<EditState>(emptyEdit())

  const load = useCallback((force = false) => {
    if (force) invalidateAdminCache('adminListFeeRecords')
    setLoading(true)
    setError('')
    callAdmin<{ list: FeeRow[] }>('adminListFeeRecords')
      .then((r) => setList(r.list || []))
      .catch((err) => {
        console.error('[AdminFees] 加载失败', err)
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

  const openNew = () => {
    const orderId = newOrderId.trim()
    if (!orderId) {
      Taro.showToast({ title: '请先填写订单 ID', icon: 'none' })
      return
    }
    setEdit(emptyEdit(orderId))
    setShowForm(true)
  }

  const openEdit = (f: FeeRow) => {
    if (!f.orderId) return
    setEdit({
      orderId: f.orderId,
      totalFee: f.totalFee != null ? String(f.totalFee) : '',
      mode: f.fee && !f.totalFee ? 'feeAmount' : 'none',
      value: f.fee ? String(f.fee) : '',
      status: f.status || '待付',
    })
    setShowForm(true)
  }

  const save = async () => {
    if (busy) return
    if (!edit.orderId.trim()) {
      Taro.showToast({ title: '请填写订单 ID', icon: 'none' })
      return
    }
    const valueNum = edit.mode === 'none' ? 0 : Number(edit.value)
    if (edit.mode !== 'none' && (!edit.value || isNaN(valueNum) || valueNum <= 0)) {
      Taro.showToast({ title: edit.mode === 'feeAmount' ? '请填写正确的信息费金额' : '请填写正确的费率百分比', icon: 'none' })
      return
    }
    if (edit.mode === 'percent' && (valueNum <= 0 || valueNum >= 100)) {
      Taro.showToast({ title: '费率应为 0~100 之间', icon: 'none' })
      return
    }

    const desc =
      edit.mode === 'none'
        ? `订单 ${edit.orderId}：仅占位（${edit.status}）`
        : edit.mode === 'feeAmount'
          ? `订单 ${edit.orderId}：总课时费 ${edit.totalFee || '待定'} 元，信息费 ${edit.value} 元（${edit.status}）`
          : `订单 ${edit.orderId}：总课时费 ${edit.totalFee} 元，按 ${edit.value}% 计费（${edit.status}）`

    Taro.showModal({
      title: '确认保存费用记录',
      content: desc,
      confirmText: '确认保存',
      cancelText: '取消',
      success(res) {
        if (!res.confirm) return
        doSave()
      },
    })
  }

  const doSave = async () => {
    setBusy(true)
    setError('')
    try {
      const payload: Record<string, unknown> = { orderId: edit.orderId.trim(), status: edit.status }
      const total = Number(edit.totalFee)
      if (edit.totalFee && total > 0) payload.totalFee = total
      if (edit.mode === 'feeAmount') payload.feeAmount = Number(edit.value)
      if (edit.mode === 'percent') payload.ratePercent = Number(edit.value)
      await callAdmin('adminRegisterFee', payload)
      invalidateAdminCache('adminListFeeRecords')
      invalidateAdminCache('adminDashboard')
      setShowForm(false)
      setNewOrderId('')
      setEdit(emptyEdit())
      Taro.showToast({ title: '已保存', icon: 'success' })
      load(true)
    } catch (err) {
      console.error('[AdminFees] 保存失败', err)
      setError((err as Error).message)
      Taro.showToast({ title: (err as Error).message || '保存失败', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  const renderOptions = <T extends string>(list: { label: string; value: T }[], current: T, onChange: (v: T) => void) => (
    <View className={styles.optionRow}>
      {list.map((o) => (
        <View key={o.value} className={`${styles.option} ${current === o.value ? styles.optionOn : ''}`} onClick={() => onChange(o.value)}>
          <Text>{o.label}</Text>
        </View>
      ))}
    </View>
  )

  return (
    <View className="admPage">
      <View className="admCard">
        <Text className="admCardTitle" style={{ display: 'block' }}>登记 / 修改费用</Text>
        <Text className="admCardSub">按订单 ID 登记（可粘贴订单列表中的订单号）</Text>
        <Input
          className="admInput"
          style={{ marginTop: '16rpx' }}
          value={newOrderId}
          placeholder="请输入订单 ID，如 o3001"
          placeholderStyle="color:#c3c4b8"
          onInput={(e) => setNewOrderId(e.detail.value)}
        />
        <View className="admBtn admBtnPrimary" style={{ height: '84rpx', marginTop: '20rpx' }} onClick={openNew}>
          <Text>登记费用</Text>
        </View>
        <Text className="admHint" style={{ marginTop: '12rpx' }}>
          金额 / 费率完全由管理员线下阶梯方案决定，可随时修改；费用仅管理端可见。
        </Text>
      </View>

      {error ? <Text className="admErrorText">{error}</Text> : null}
      {loading && list.length === 0 ? <View className="admLoadingBlock">加载中…</View> : null}
      {!loading && list.length === 0 && !error ? (
        <View className="admEmptyBlock">
          <Text>暂无费用记录</Text>
        </View>
      ) : null}

      {list.map((f) => (
        <View key={f.id} className="admCard">
          <View className="admCardHeader">
            <View style={{ minWidth: 0 }}>
              <Text className="admCardTitle">{f.demand || '需求单'} · {f.teacherName || '—'}</Text>
              <Text className="admCardSub">
                {f.orderId ? `订单 ${f.orderId}` : '未关联订单'}
                {f.calcMode ? ` · 计算方式：${calcModeLabel(f.calcMode)}` : ''}
              </Text>
            </View>
            <View className={styles.amount}>
              <Text className={`admTag admTag${statusColorClass(f.status)}`}>{f.status}</Text>
              <Text className="admHint">
                总 {fmtAmount(f.totalFee)} · 费 {fmtAmount(f.fee)}
              </Text>
            </View>
          </View>
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text className="admHint">更新于 {fmtTime(f.updateTime || f.createTime)}</Text>
            {f.orderId ? (
              <View className="admBtn admBtnGhost" onClick={() => openEdit(f)}>
                <Text>编辑</Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}

      {showForm ? (
        <View className="admModalMask" onClick={() => !busy && setShowForm(false)}>
          <View className="admModal" onClick={(e) => e.stopPropagation()}>
            <Text className="admModalTitle">费用登记 / 调整</Text>
            <Text className="admHint" style={{ marginBottom: '16rpx', wordBreak: 'break-all' }}>订单：{edit.orderId}</Text>

            <View className="admFormGroup">
              <Text className="admLabel">总课时费（元）</Text>
              <Input
                className="admInput"
                type="number"
                value={edit.totalFee}
                placeholder="如 1200（费率计算时需要）"
                placeholderStyle="color:#c3c4b8"
                onInput={(e) => setEdit({ ...edit, totalFee: e.detail.value })}
              />
            </View>

            <View className="admFormGroup">
              <Text className="admLabel">信息费确定方式</Text>
              {renderOptions<Mode>(
                [
                  { label: '暂不计算（占位待付）', value: 'none' },
                  { label: '自定义金额', value: 'feeAmount' },
                  { label: '按费率计算', value: 'percent' },
                ],
                edit.mode,
                (m) => setEdit({ ...edit, mode: m })
              )}
            </View>

            {edit.mode !== 'none' ? (
              <View className="admFormGroup">
                <Text className="admLabel">{edit.mode === 'feeAmount' ? '信息费金额（元）' : '费率百分比（%）'}</Text>
                <Input
                  className="admInput"
                  type="digit"
                  value={edit.value}
                  placeholder={edit.mode === 'feeAmount' ? '如 100' : '如 6'}
                  placeholderStyle="color:#c3c4b8"
                  onInput={(e) => setEdit({ ...edit, value: e.detail.value })}
                />
              </View>
            ) : null}

            <View className="admFormGroup">
              <Text className="admLabel">结清状态</Text>
              {renderOptions(
                [
                  { label: '待付（未结清）', value: '待付' },
                  { label: '已付（已结清）', value: '已付' },
                ],
                edit.status,
                (s) => setEdit({ ...edit, status: s })
              )}
            </View>

            <View className="admModalActions">
              <View className="admActionBtn">
                <View className="admBtn admBtnGhost" style={{ height: '88rpx' }} onClick={() => setShowForm(false)}>
                  <Text>取消</Text>
                </View>
              </View>
              <View className="admActionBtn">
                <View className="admBtn admBtnPrimary" style={{ height: '88rpx' }} onClick={save}>
                  <Text>{busy ? '保存中…' : '保存'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
