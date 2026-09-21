import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { callAdmin, guardAdminPage } from '@/services/admin'
import AdminParentContact from '@/components/AdminParentContact'
import { fmtTime, statusColorClass, teacherCollegeMajorText } from '@/utils/adminFmt'
import type { QueryResult, QueryApplicant, QueryDemand } from '@/types/admin'
import styles from './index.module.scss'

type Mode = 'demand' | 'teacher'

const MODES: Array<{ key: Mode; label: string; placeholder: string }> = [
  { key: 'demand', label: '需求单号', placeholder: '输入需求单号，如 1024 / d1001' },
  { key: 'teacher', label: '老师编号', placeholder: '输入老师 5 位专属编号，如 10001' },
]

function Field({ k, v, strong }: { k: string; v?: string | number; strong?: boolean }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <View className="admField">
      <Text className="admFieldKey">{k}</Text>
      <Text className={strong ? styles.phoneValue : 'admFieldVal'}>{v}</Text>
    </View>
  )
}

function ApplicantCard({ a }: { a: QueryApplicant }) {
  return (
    <View className="admCard">
      <View className="admCardHeader">
        <Text className="admCardTitle">
          🧑‍🏫 {a.name || '老师'}
          {a.verified ? '（已认证）' : ''}
          {a.teacherNo ? ` · 编号 ${a.teacherNo}` : ''}
        </Text>
        {a.status ? <Text className={`admTag admTag${statusColorClass(a.status)}`}>{a.status}</Text> : null}
      </View>
      <Field k="联系电话" v={a.phone} strong />
      <Field k="学院 / 专业" v={[a.college, a.major].filter(Boolean).join(' / ')} />
      <Field k="可教科目" v={a.subject} />
      <Field k="期望时薪" v={a.rate ? `${a.rate}` : undefined} />
      <Field k="报名时间" v={a.createTime ? fmtTime(a.createTime) : undefined} />
      <Field k="关联订单" v={a.orderStatus ? `${a.orderStatus}${a.orderId ? `（${a.orderId}）` : ''}` : '暂无订单'} />
      <Field k="缴费状态" v={a.feeStatus || '未登记'} />
    </View>
  )
}

function DemandHeader({ d }: { d: QueryDemand }) {
  return (
    <View className="admCard">
      <View className="admCardHeader">
        <Text className="admCardTitle">需求单号：{d.id}</Text>
        {d.status ? <Text className={`admTag admTag${statusColorClass(d.status)}`}>{d.status}</Text> : null}
      </View>
      <Field k="学段科目" v={`${d.grade || ''} ${d.subject || ''}`.trim()} />
      <Field k="标题" v={d.title} />
      <Field k="预算(元/时)" v={d.budget} />
      <Field k="区域" v={d.area} />
      <Field k="性别要求" v={d.gender} />
      <Field k="服务时段" v={d.classTime} />
      <Field k="内容说明" v={d.note} />
      <Field k="审核状态" v={d.auditStatus} />
      <Field k="订单状态" v={d.orderStatus || '暂无订单'} />
      <Field k="缴费状态" v={d.feeStatus || '未登记'} />
      <Field k="提交时间" v={d.createTime ? fmtTime(d.createTime) : undefined} />
      <View style={{ marginTop: '16rpx' }}>
        <AdminParentContact
          variant="card"
          nickname={d.parent?.nickname}
          phone={d.parent?.phone}
          wechat={d.parent?.wechat}
          area={d.parent?.area}
        />
      </View>
    </View>
  )
}

export default function AdminQueryPage() {
  const [mode, setMode] = useState<Mode>('demand')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    guardAdminPage()
  }, [])

  const search = async () => {
    const kw = keyword.trim()
    if (!kw) {
      Taro.showToast({ title: '请输入检索关键词', icon: 'none' })
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    setSearched(true)
    try {
      const res = await callAdmin<QueryResult>('adminQueryOrder', { type: mode, keyword: kw })
      setResult(res)
    } catch (err) {
      console.error('[AdminQuery] 检索失败', err)
      setError((err as Error).message || '检索失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const applicants = result?.applicants || []
  const demands = result?.demands || []
  const orders = result?.orders || []
  const feeRecords = result?.feeRecords || []
  const demandEmpty = result?.type === 'demand' && !result.demand
  const teacherEmpty = result?.type === 'teacher' && !result.teacher
  const noResult = searched && !loading && !error && (demandEmpty || teacherEmpty)

  return (
    <View className="admPage">
      <View className={styles.searchCard}>
        <View className={styles.modeRow}>
          {MODES.map((m) => (
            <View
              key={m.key}
              className={`admChip ${mode === m.key ? 'admChipOn' : ''}`}
              onClick={() => setMode(m.key)}
            >
              <Text>{m.label}</Text>
            </View>
          ))}
        </View>
        <View className={styles.inputRow}>
          <Input
            className={styles.searchInput}
            value={keyword}
            placeholder={MODES.find((m) => m.key === mode)?.placeholder || '请输入检索关键词'}
            placeholderClass={styles.placeholder}
            confirmType="search"
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={search}
          />
          <View className={styles.searchBtn} onClick={search}>
            <Text className={styles.searchBtnText}>{loading ? '检索中…' : '检索'}</Text>
          </View>
        </View>
        <Text className="admHint" style={{ display: 'block', marginTop: '16rpx' }}>
          支持按需求单号精准检索订单及其全部报名人员信息，或按老师 5 位专属编号定位老师联系方式与关联业务。
        </Text>
      </View>

      {error ? <Text className="admErrorText">{error}</Text> : null}
      {loading ? <View className="admLoadingBlock">检索中…</View> : null}
      {noResult ? (
        <View className="admEmptyBlock">
          <Text>未检索到匹配结果，请核对{mode === 'demand' ? '需求单号' : '老师编号'}后重试</Text>
        </View>
      ) : null}

      {/* ===== 需求单号检索结果 ===== */}
      {result?.type === 'demand' && result.demand ? (
        <>
          <DemandHeader d={result.demand} />
          <Text className="admSectionTitle">报名人员（{applicants.length}）</Text>
          {applicants.length === 0 ? (
            <View className="admEmptyBlock">
              <Text>该需求暂无报名记录</Text>
            </View>
          ) : (
            applicants.map((a) => <ApplicantCard key={a.id} a={a} />)
          )}
        </>
      ) : null}

      {/* ===== 老师编号检索结果 ===== */}
      {result?.type === 'teacher' && result.teacher ? (
        <>
          <View className="admCard">
            <View className="admCardHeader">
              <Text className="admCardTitle">
                {result.teacher.name || '老师'}
                {result.teacher.verified ? <Text style={{ marginLeft: '12rpx', fontSize: '22rpx', color: '#2d7a54' }}>已认证</Text> : null}
              </Text>
              <Text className="admHint">编号 {result.teacher.teacherNo || '未颁发'}</Text>
            </View>
            <Field k="联系电话" v={result.teacher.phone} strong />
            <Field k="性别" v={result.teacher.gender} />
            <Field k="学院 / 专业" v={teacherCollegeMajorText(result.teacher) || '—'} />
            <Field k="可教年级" v={result.teacher.grades?.join('、')} />
            <Field k="可教科目" v={result.teacher.subjects?.join('、')} />
            <Field k="期望时薪" v={result.teacher.rate ? `${result.teacher.rate}` : undefined} />
            <Field k="实名档案" v={result.teacher.realNameLocked ? '已固化' : '未固化'} />
          </View>

          <Text className="admSectionTitle">关联需求（{demands.length}）</Text>
          {demands.length === 0 ? (
            <View className="admEmptyBlock">
              <Text>该老师暂无关联需求</Text>
            </View>
          ) : (
            demands.map((d) => (
              <View key={d.id} className="admCard">
                <View className="admCardHeader">
                  <Text className="admCardTitle">需求单号：{d.id}</Text>
                  {d.applyStatus ? <Text className={`admTag admTag${statusColorClass(d.applyStatus)}`}>{d.applyStatus}</Text> : null}
                </View>
                <Field k="学段科目" v={`${d.grade || ''} ${d.subject || ''}`.trim()} />
                <Field k="标题" v={d.title} />
                <Field k="预算(元/时)" v={d.budget} />
                <Field k="区域" v={d.area} />
                <Field k="订单状态" v={d.orderStatus || '暂无订单'} />
                <Field k="缴费状态" v={d.feeStatus || '未登记'} />
                {/* 家长联系电话：按老师检索时同样可直接联系家长 */}
                <AdminParentContact
                  nickname={d.parent?.nickname}
                  phone={d.parent?.phone}
                />
              </View>
            ))
          )}
        </>
      ) : null}

      {/* ===== 订单与缴费明细 ===== */}
      {result && (orders.length > 0 || feeRecords.length > 0) ? (
        <>
          <Text className="admSectionTitle">关联订单（{orders.length}）</Text>
          {orders.map((o) => (
            <View key={o.id} className="admCard">
              <View className="admCardHeader">
                <Text className="admCardTitle">订单 {o.id}</Text>
                {o.status ? <Text className={`admTag admTag${statusColorClass(o.status)}`}>{o.status}</Text> : null}
              </View>
              <Field k="需求单号" v={o.demandId} />
              <Field k="老师标识" v={o.teacherId} />
              <Field k="创建时间" v={o.createTime ? fmtTime(o.createTime) : undefined} />
              <Field k="确认时间" v={o.confirmedAt ? fmtTime(o.confirmedAt) : undefined} />
              <Field k="取消时间" v={o.cancelTime ? fmtTime(o.cancelTime) : undefined} />
            </View>
          ))}

          <Text className="admSectionTitle">信息费记录（{feeRecords.length}）</Text>
          {feeRecords.map((f) => (
            <View key={f.id} className="admCard">
              <View className="admCardHeader">
                <Text className="admCardTitle">信息费 {f.id}</Text>
                {f.status ? <Text className={`admTag admTag${statusColorClass(f.status)}`}>{f.status}</Text> : null}
              </View>
              <Field k="需求单号" v={f.demandId} />
              <Field k="订单" v={f.orderId} />
              <Field k="课时总额(元)" v={f.totalFee} />
              <Field k="信息费(元)" v={f.fee} />
              <Field k="登记时间" v={f.createTime ? fmtTime(f.createTime) : undefined} />
            </View>
          ))}
        </>
      ) : null}
    </View>
  )
}
