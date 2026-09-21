import { View, Text, Textarea } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import ConfirmDialog from '@/components/ConfirmDialog'
import ImageGallery from '@/components/ImageGallery'
import LoadableImage from '@/components/LoadableImage'
import { callAdmin, guardAdminPage, invalidateAdminCache } from '@/services/admin'
import { fmtTime, statusColorClass, teacherCollegeMajorText } from '@/utils/adminFmt'
import type { GalleryImage } from '@/utils/imageUtil'
import type { VerifyRow, VerifyMaterial, VerifyPage } from '@/types/admin'
import styles from './index.module.scss'

const STATUS_TABS = ['待审核', '已通过', '已驳回', '全部'] as const
const PARTNER_SCHOOL = '湖南师范大学'
// 服务端分页：审核记录随规模增长，按页拉取 + 上拉加载，避免大量数据下漏审
const PAGE_SIZE = 20

function materialsOf(v: VerifyRow): VerifyMaterial[] {
  return v.materials || []
}

/** 缩略图地址：微信端优先云存储 fileID（cloud:// 直显，无需域名）；H5 用 http 直链 */
function thumbSrc(m: VerifyMaterial): string {
  if (process.env.TARO_ENV === 'weapp') {
    return m.fileID || m.url || ''
  }
  return m.url || ''
}

export default function AdminVerificationsPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>('待审核')
  const [list, setList] = useState<VerifyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  // 分页状态：skip 为已加载条数，hasMore 由服务端 total 推导
  const [skip, setSkip] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  // 驳回原因弹层
  const [rejecting, setRejecting] = useState<VerifyRow | null>(null)
  const [rejectReason, setRejectReason] = useState('材料照片不清晰或与学籍信息不符，请重新上传')
  // 通过二次确认
  const [confirming, setConfirming] = useState<VerifyRow | null>(null)
  // 大图浏览（原生预览优先）
  const [gallery, setGallery] = useState<{ visible: boolean; items: GalleryImage[]; current: number }>({
    visible: false,
    items: [],
    current: 0,
  })

  const load = useCallback(
    (force = false, nextSkip = 0) => {
      if (force) invalidateAdminCache('adminListVerifications')
      setLoading(true)
      setError('')
      callAdmin<VerifyPage>('adminListVerifications', {
        status: tab,
        skip: nextSkip,
        limit: PAGE_SIZE,
      })
        .then((r) => {
          const rows = r.list || []
          // nextSkip=0 表示首屏/刷新/切换筛选：整体替换；否则为追加下一页
          setList((prev) => (nextSkip === 0 ? rows : [...prev, ...rows]))
          setSkip(nextSkip)
          setTotal(r.total ?? rows.length)
          setHasMore(typeof r.hasMore === 'boolean' ? r.hasMore : false)
        })
        .catch((err) => {
          console.error('[AdminVerifications] 加载失败', err)
          setError((err as Error).message)
        })
        .finally(() => {
          setLoading(false)
          Taro.stopPullDownRefresh()
        })
    },
    [tab]
  )

  useEffect(() => {
    if (!guardAdminPage()) return
    load(false, 0)
  }, [load])

  usePullDownRefresh(() => {
    load(true, 0)
  })

  // 上拉加载更多：服务端还有数据时按页追加，避免大量认证记录下遗漏待审申请
  useReachBottom(() => {
    if (loading || !hasMore) return
    load(false, skip + PAGE_SIZE)
  })

  const review = async (row: VerifyRow, action: '通过' | '驳回', reason = '') => {
    if (busyId) return
    if (action === '驳回' && !String(reason || '').trim()) {
      Taro.showToast({ title: '请填写驳回原因', icon: 'none' })
      return
    }
    setBusyId(row.id)
    setError('')
    try {
      await callAdmin('adminReviewVerify', {
        verificationId: row.id,
        action,
        rejectReason: action === '驳回' ? reason : '',
      })
      invalidateAdminCache('adminListVerifications')
      invalidateAdminCache('adminDashboard')
      setList((prev) => prev.filter((v) => v.id !== row.id))
      setTotal((t) => Math.max(0, t - 1))
      Taro.showToast({ title: action === '通过' ? '已通过并展示「已认证」' : '已驳回', icon: 'success' })
    } catch (err) {
      console.error('[AdminVerifications] 审核失败', err)
      setError((err as Error).message)
      Taro.showToast({ title: (err as Error).message || '操作失败', icon: 'none' })
    } finally {
      setBusyId('')
      setConfirming(null)
      setRejecting(null)
      setRejectReason('材料照片不清晰或与学籍信息不符，请重新上传')
    }
  }

  const openGalleryAt = (v: VerifyRow, startIdx: number) => {
    const items = materialsOf(v).map<GalleryImage>((m, i) => ({
      key: `${v.id}_${i}`,
      name: m.name || `材料图${i + 1}`,
      fileID: m.fileID,
      src: m.url,
      text: m.text,
    }))
    setGallery({ visible: true, items, current: startIdx })
  }

  const currentCount = `${tab === '全部' ? '' : tab}认证申请`

  return (
    <View className="admPage">
      <View className="admFilterBar">
        {STATUS_TABS.map((s) => (
          <View key={s} className={`admChip ${tab === s ? 'admChipOn' : ''}`} onClick={() => setTab(s)}>
            <Text>{s === '全部' ? '全部记录' : s}</Text>
          </View>
        ))}
      </View>

      <View className="admHeaderRow">
        <Text className="admHint">
          学籍院校固定为{PARTNER_SCHOOL}（平台唯一合作院校）。审核前请点开材料照片核对姓名、院校与证件是否一致。
          {total > 0 ? ` 共 ${total} 条，已加载 ${list.length} 条。` : ''}
        </Text>
        <View
          className="admTextBtn"
          onClick={() => {
            load(true, 0)
          }}
        >
          <Text>刷新列表</Text>
        </View>
      </View>

      {error ? <Text className="admErrorText">{error}</Text> : null}
      {loading && list.length === 0 ? <View className="admLoadingBlock">加载中…</View> : null}
      {!loading && list.length === 0 && !error ? (
        <View className="admEmptyBlock">
          <Text>暂无{currentCount}</Text>
        </View>
      ) : null}

      {list.map((v) => {
        const materials = materialsOf(v)
        const identity = teacherCollegeMajorText(v)
        return (
          <View key={v.id} className="admCard">
            <View className="admCardHeader">
              <Text className="admCardTitle">
                {v.name || '未填写姓名'}
                {identity ? `（${identity}）` : ''}
              </Text>
              <Text className={`admTag admTag${statusColorClass(v.status)}`}>{v.status || '—'}</Text>
            </View>
            <Text className="admCardSub">
              学院 · 专业：{identity || '—'} ｜ 学籍院校（固定）：{PARTNER_SCHOOL}
              {v.authorized ? ' ｜ 已授权展示' : ' ｜ 未授权展示'}
            </Text>
            {/* 申请人联系方式与专属编号（仅管理员可见）：材料存疑时可直接联系核实 */}
            <Text className="admCardSub">
              联系电话：{v.phone || '未填写'} ｜ 专属编号：{v.teacherNo || '未颁发'}
            </Text>
            {v.createTime ? (
              <Text className="admHint" style={{ marginTop: '8rpx' }}>提交于 {fmtTime(v.createTime)}</Text>
            ) : null}

            {materials.length > 0 ? (
              <View className={styles.materialGrid}>
                {materials.map((m, i) => {
                  const tSrc = thumbSrc(m)
                  if (tSrc) {
                    return (
                      <View key={i} className={styles.materialThumb} onClick={() => openGalleryAt(v, i)}>
                        <LoadableImage src={tSrc} name={m.name} />
                        <Text className={styles.materialName}>{m.name || '照片'}</Text>
                      </View>
                    )
                  }
                  if (m.text) {
                    return (
                      <View key={i} className={styles.textMaterial} onClick={() => openGalleryAt(v, i)}>
                        <Text>{m.text}（查看）</Text>
                      </View>
                    )
                  }
                  return (
                    <View key={i} className={styles.textMaterial}>
                      <Text>{m.name || '材料'}（无图片内容）</Text>
                    </View>
                  )
                })}
              </View>
            ) : (
              <View className="admCard" style={{ background: '#fdeccd', boxShadow: 'none' }}>
                <Text style={{ color: '#b97a12', fontSize: '24rpx', lineHeight: 1.7 }}>
                  该记录没有可预览的学籍材料图片（历史数据可能仅登记文本或上传未成功）。如需继续核验，可先「驳回」，通知老师重新上传清晰照片。
                </Text>
              </View>
            )}
            <Text className={styles.hint}>
              云存储图片经微信云开发直接加载（无需配置任何域名）；弱网/显示失败时可点缩略图「点击重试」或下拉刷新。
            </Text>

            {v.rejectReason ? <Text className={styles.rejectReason}>驳回原因：{v.rejectReason}</Text> : null}

            {v.status === '待审核' ? (
              <View style={{ display: 'flex', gap: '20rpx', marginTop: '24rpx' }}>
                <View className="admBtn admBtnPrimary" style={{ flex: 1, height: '80rpx' }} onClick={() => setConfirming(v)}>
                  <Text>{busyId === v.id ? '处理中…' : '照片核验通过'}</Text>
                </View>
                <View className="admBtn admBtnRed" style={{ flex: 1, height: '80rpx' }} onClick={() => setRejecting(v)}>
                  <Text>驳回</Text>
                </View>
              </View>
            ) : null}
          </View>
        )
      })}

      {/* 分页提示：大量记录下明确告知是否还有更早的申请待加载 */}
      {list.length > 0 ? (
        <Text className="admHint" style={{ display: 'block', textAlign: 'center', padding: '20rpx 0' }}>
          {hasMore ? (loading ? '加载中…' : '上拉加载更多…') : `已显示全部 ${list.length} 条记录`}
        </Text>
      ) : null}

      {/* 通过：二次确认 */}
      <ConfirmDialog
        visible={!!confirming}
        title="确认审核通过？"
        content={`通过后「${confirming?.name || '该老师'}」将在家长端展示「已认证」标签。请确认已核对照片与学籍信息一致。`}
        confirmText="确认通过"
        cancelText="再核对"
        onConfirm={() => {
          if (confirming) review(confirming, '通过')
        }}
        onCancel={() => setConfirming(null)}
      />

      {/* 驳回：填写原因弹层 */}
      {rejecting ? (
        <View className="admModalMask">
          <View className="admModal">
            <Text className="admModalTitle">驳回申请</Text>
            <Text className="admHint" style={{ marginBottom: '16rpx' }}>
              驳回原因将展示给老师，请说明需要补充/修正的内容。
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

      <ImageGallery
        items={gallery.items}
        current={gallery.current}
        visible={gallery.visible}
        onClose={() => setGallery((g) => ({ ...g, visible: false }))}
      />
    </View>
  )
}
