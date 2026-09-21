import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { callAdmin, guardAdminPage, invalidateAdminCache } from '@/services/admin'
import AdminParentContact from '@/components/AdminParentContact'
import { groupDeliveries, type DeliveryGroup } from '@/utils/adminDelivery'
import { fmtTime, statusColorClass, teacherCollegeMajorText } from '@/utils/adminFmt'
import type { DeliveryRow, TeacherResume } from '@/types/admin'
import styles from './index.module.scss'

type ViewState =
  | { view: 'list' }
  | { view: 'group'; group: DeliveryGroup }
  | { view: 'teacher'; group: DeliveryGroup; teacherId: string }

function Field({ k, v }: { k: string; v?: string }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <View className="admField">
      <Text className="admFieldKey">{k}</Text>
      <Text className="admFieldVal">{v}</Text>
    </View>
  )
}

export default function AdminDeliveriesPage() {
  const [list, setList] = useState<DeliveryRow[]>([])
  const [view, setView] = useState<ViewState>({ view: 'list' })
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback((force = false) => {
    if (force) invalidateAdminCache('adminListDeliveries')
    setLoading(true)
    setError('')
    callAdmin<{ list: DeliveryRow[] }>('adminListDeliveries')
      .then((r) => setList(r.list || []))
      .catch((err) => {
        console.error('[AdminDeliveries] 加载失败', err)
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

  const groups = useMemo(() => groupDeliveries(list), [list])

  const toggleRecommend = (row: DeliveryRow) => {
    if (busyId) return
    Taro.showModal({
      title: row.recommended ? '取消平台推荐' : '标记为平台推荐',
      content: row.recommended
        ? '取消后该老师不再优先展示给家长，确认取消？'
        : '标记后该老师在家长端以「平台推荐」身份优先展示，确认推荐？',
      confirmText: '确认',
      cancelText: '取消',
      success(res) {
        if (!res.confirm) return
        setBusyId(row.id)
        setError('')
        callAdmin('adminRecommend', {
          demandId: row.demandId,
          teacherId: row.teacherId,
          recommended: !row.recommended,
        })
          .then(() => {
            invalidateAdminCache('adminListDeliveries')
            setList((prev) => prev.map((r) => (r.id === row.id ? { ...r, recommended: !row.recommended } : r)))
            Taro.showToast({ title: '已更新', icon: 'success' })
          })
          .catch((err) => {
            console.error('[AdminDeliveries] 更新推荐失败', err)
            setError((err as Error).message)
            Taro.showToast({ title: (err as Error).message || '操作失败', icon: 'none' })
          })
          .finally(() => setBusyId(''))
      },
    })
  }

  const goBack = () => {
    if (view.view === 'teacher') {
      setView({ view: 'group', group: view.group })
      return
    }
    setView({ view: 'list' })
  }

  // ---------- 列表视图 ----------
  if (view.view === 'list') {
    return (
      <View className="admPage">
        <View className="admHeaderRow">
          <Text className="admHint">
            已按「需求单」聚合：同一需求单下所有老师的投递去向归入同一单元格，点击查看老师明细与完整简历。
          </Text>
        </View>
        {error ? <Text className="admErrorText">{error}</Text> : null}
        {loading && groups.length === 0 ? <View className="admLoadingBlock">加载中…</View> : null}
        {!loading && groups.length === 0 && !error ? (
          <View className="admEmptyBlock">
            <Text>暂无投递 / 咨询记录</Text>
          </View>
        ) : null}
        {groups.map((g) => (
          <View key={g.demandId || `__empty__${g.items[0]?.id || g.total}`} className="admCard admCardLink" onClick={() => setView({ view: 'group', group: g })}>
            <View className="admCardHeader">
              <Text className="admCardTitle" style={{ maxWidth: '46%' }}>{g.demandLabel}</Text>
              <View className={styles.badgeRow}>
                {g.orderStatuses.map((s) => (
                  <Text key={s} className={`admTag admTag${statusColorClass(s)}`}>订单 {s}</Text>
                ))}
                <Text className="admTag admTagGreen">{g.recommendedCount} 推荐</Text>
                <Text className="admTag admTagAmber">{g.total} 条投递</Text>
              </View>
            </View>
            <Text className={styles.groupLine}>
              📍 {g.demand?.area || '—'} · 家长 {g.parent?.nickname || '—'}
            </Text>
            {/* 家长联系电话：列表视图即可直接联系家长 */}
            <AdminParentContact nickname={g.parent?.nickname} phone={g.parent?.phone} />
            <Text className={styles.groupLine}>
              老师：{g.items.map((i) => i.teacher?.name).filter(Boolean).join('、') || '—'} · 点击查看该需求下全部投递 →
            </Text>
            <Text className={styles.phoneLine}>
              📞 老师电话：{g.items.map((i) => i.teacher?.phone).filter(Boolean).join('、') || '—'}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  const g = view.group
  const d = g.demand

  // ---------- 老师完整简历视图 ----------
  if (view.view === 'teacher') {
    return (
      <TeacherDetailView
        teacherId={view.teacherId}
        group={g}
        onBack={goBack}
      />
    )
  }

  // ---------- 需求分组视图 ----------
  return (
    <View className="admPage">
      <View className={styles.backBar}>
        <View className="admBtn admBtnGhost" onClick={goBack}>
          <Text>← 返回投递列表</Text>
        </View>
      </View>
      <Text className="admSectionTitle">投递去向 · 家长需求</Text>
      <View className="admCard">
        <Text className="admCardTitle" style={{ display: 'block' }}>
          {d?.grade || ''} {d?.subject || ''}
          {d?.budget ? ` · ${d.budget} 元/时` : ''}
        </Text>
        {d?.title ? <Text className={styles.demandNote} style={{ marginTop: '12rpx' }}>{d.title}</Text> : null}
        <Text className={styles.groupLine} style={{ marginTop: '12rpx' }}>
          📍 {d?.area || '区域待定'}
          {g.parent?.nickname ? ` · 家长 ${g.parent.nickname}` : ''}
        </Text>
        {d?.gender ? <Text className={styles.groupLine}>性别要求：{d.gender}</Text> : null}
        {d?.classTime ? <Text className={styles.groupLine}>服务时段：{d.classTime}</Text> : null}
        {d?.note ? <Text className={styles.demandNote}>{d.note}</Text> : null}
        <Text className="admHint" style={{ marginTop: '12rpx' }}>
          共 {g.total} 条投递记录 · {g.recommendedCount} 条平台推荐
          {g.orderStatuses.length ? ` · 订单状态：${g.orderStatuses.join(' / ')}` : ''}
        </Text>
      </View>

      {/* 家长联系电话：分组详情内完整展示，支持一键拨打 / 复制 */}
      <AdminParentContact
        variant="card"
        nickname={g.parent?.nickname}
        phone={g.parent?.phone}
        wechat={g.parent?.wechat}
      />

      <Text className="admSectionTitle">关联老师（{g.items.length}）</Text>
      {g.items.map((row) => (
        <View key={row.id} className="admCard admCardLink" onClick={() => row.teacherId && setView({ view: 'teacher', group: g, teacherId: row.teacherId })}>
          <View className="admCardHeader">
            <Text className="admCardTitle" style={{ maxWidth: '70%' }}>
              🧑‍🏫 {row.teacher?.name || '老师'}
              {row.teacher?.verified ? '（已认证）' : ''}
              {row.recommended ? ' ⭐平台推荐' : ''}
              {row.orderStatus ? ` · 已有订单：${row.orderStatus}` : ''}
            </Text>
            <Text className="admHint">{fmtTime(row.createTime)}</Text>
          </View>
          <Text className={styles.rateLine}>
            {teacherCollegeMajorText(row.teacher) ? `${teacherCollegeMajorText(row.teacher)} · ` : ''}
            {row.teacher?.subject || ''} · {row.teacher?.rate ? `${row.teacher.rate} 元/时` : '时薪待议'}
            <Text style={{ color: '#2d7a54' }}> · 点击查看完整简历 →</Text>
          </Text>
          <Text className={styles.phoneLine}>
            📞 老师电话：{row.teacher?.phone || '—'}
            {row.teacher?.teacherNo ? ` · 编号 ${row.teacher.teacherNo}` : ''}
          </Text>
          {row.riskNote ? <Text className={styles.riskLine}>⚠️ {row.riskNote}</Text> : null}
          <View style={{ marginTop: '20rpx' }} onClick={(e) => e.stopPropagation()}>
            <View className={`admBtn ${row.recommended ? 'admBtnAmber' : 'admBtnGreen'}`} onClick={() => toggleRecommend(row)}>
              <Text>{row.recommended ? '取消平台推荐' : '标记为平台推荐'}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

// ============ 老师完整简历 ============
function TeacherDetailView({ teacherId, group, onBack }: { teacherId: string; group: DeliveryGroup; onBack: () => void }) {
  const [teacher, setTeacher] = useState<TeacherResume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 合规修改实名档案（仅管理员可发起，需填写修改原因留痕）
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', college: '', major: '', reason: '' })

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    callAdmin<{ teacher: TeacherResume }>('adminGetTeacherDetail', { teacherId })
      .then((r) => setTeacher(r.teacher || null))
      .catch((err) => {
        console.error('[AdminDeliveries] 老师详情失败', err)
        setError((err as Error).message)
      })
      .finally(() => setLoading(false))
  }, [teacherId])

  useEffect(() => {
    load()
  }, [load])

  const startEdit = () => {
    if (!teacher) return
    setForm({
      name: teacher.name || '',
      college: teacher.college || '',
      major: teacher.major || '',
      reason: '',
    })
    setEditing(true)
  }

  const saveRealName = async () => {
    if (!teacher || saving) return
    if (!form.name.trim() || !form.college.trim() || !form.major.trim()) {
      Taro.showToast({ title: '姓名/学院/专业均不能为空', icon: 'none' })
      return
    }
    if (!form.reason.trim()) {
      Taro.showToast({ title: '请填写修改原因', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await callAdmin('adminUpdateRealName', {
        openid: teacher.openid,
        name: form.name.trim(),
        college: form.college.trim(),
        major: form.major.trim(),
        reason: form.reason.trim(),
      })
      invalidateAdminCache('adminGetTeacherDetail')
      invalidateAdminCache('adminListDeliveries')
      invalidateAdminCache('adminListOrders')
      invalidateAdminCache('adminListApplications')
      Taro.showToast({ title: '实名档案已更新', icon: 'success' })
      setEditing(false)
      load()
    } catch (err) {
      console.error('[AdminDeliveries] 修改实名失败', err)
      Taro.showToast({ title: (err as Error).message || '修改失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const d = group.demand

  return (
    <View className="admPage">
      <View className={styles.backBar}>
        <View className="admBtn admBtnGhost" onClick={onBack}>
          <Text>← 返回投递去向</Text>
        </View>
      </View>
      <Text className="admSectionTitle">老师完整简历</Text>

      {error ? <Text className="admErrorText">{error}</Text> : null}
      {loading ? <View className="admLoadingBlock">加载中…</View> : null}
      {!loading && !teacher && !error ? (
        <View className="admEmptyBlock">
          <Text>未找到该老师简历</Text>
        </View>
      ) : null}

      {teacher ? (
        <View className="admCard">
          <View className="admCardHeader">
            <Text className="admCardTitle">
              {teacher.name || '老师'}
              {teacher.verified ? <Text style={{ marginLeft: '12rpx', fontSize: '22rpx', color: '#2d7a54' }}>已认证</Text> : null}
            </Text>
            <Text className="admHint">{teacher.id}</Text>
          </View>
          {teacher.source ? <Text className="admCardSub">数据来源：{teacher.source}</Text> : null}

          <Text className="admSectionTitle">基本信息</Text>
          <Field k="学籍院校" v="湖南师范大学（平台唯一合作院校）" />
          <Field k="学院 / 专业" v={teacherCollegeMajorText(teacher) || '—'} />
          <Field k="学历" v={teacher.degree} />
          <Field k="性别" v={teacher.gender} />
          <Field k="教龄" v={teacher.years} />
          <Field k="可教年级" v={teacher.grades?.join('、')} />
          <Field k="可教科目" v={teacher.subjects?.join('、')} />
          <Field k="认证状态" v={teacher.verificationStatus || (teacher.verified ? '已认证' : '未认证')} />
          <Field k="实名档案" v={teacher.realNameLocked ? '已固化（不可修改，管理员可发起合规修改）' : '未固化'} />

          <Text className="admSectionTitle">联系方式与编号（仅管理员可见）</Text>
          <Field k="专属编号" v={teacher.teacherNo || '未颁发'} />
          <Field k="联系电话" v={teacher.phone || '—'} />

          <Text className="admSectionTitle">服务范围与时薪</Text>
          <Field k="期望时薪" v={teacher.rate ? `${teacher.rate} 元/时` : '面议'} />
          <Field k="可服务区域" v={teacher.districts?.join('、')} />
          <Field k="可服务时段" v={teacher.timeSlots?.join('；')} />

          {teacher.intro ? (
            <>
              <Text className="admSectionTitle">自我介绍</Text>
              <Text className={styles.demandNote}>{teacher.intro}</Text>
            </>
          ) : null}

          <View style={{ marginTop: '24rpx' }}>
            <View className="admBtn admBtnAmber" onClick={startEdit}>
              <Text>合规修改实名信息</Text>
            </View>
          </View>

          <Text className="admHint" style={{ marginTop: '20rpx' }}>
            本次投递需求：{d?.grade || ''} {d?.subject || ''}
            {d?.budget ? ` · ${d.budget} 元/时` : ''}
            {d?.area ? ` · ${d.area}` : ''}
          </Text>
          {/* 关联需求所属家长：可直接联系家长推进对接 */}
          <View style={{ marginTop: '20rpx' }}>
            <AdminParentContact
              variant="card"
              nickname={group.parent?.nickname}
              phone={group.parent?.phone}
              wechat={group.parent?.wechat}
            />
          </View>
        </View>
      ) : null}

      {editing && teacher ? (
        <View className="admModalMask">
          <View className="admModal">
            <Text className="admModalTitle">合规修改实名学籍档案</Text>
            <Text className="admHint" style={{ marginBottom: '16rpx' }}>
              认证通过后的实名信息为不可修改的正式档案，本次修改将写入操作日志留痕。院校固定为平台合作院校，不可修改。
            </Text>
            <View className="admField">
              <Text className="admFieldKey">真实姓名</Text>
              <Input className="admInput" value={form.name} onInput={(e) => setForm({ ...form, name: e.detail.value })} />
            </View>
            <View className="admField">
              <Text className="admFieldKey">学院</Text>
              <Input className="admInput" value={form.college} onInput={(e) => setForm({ ...form, college: e.detail.value })} />
            </View>
            <View className="admField">
              <Text className="admFieldKey">专业</Text>
              <Input className="admInput" value={form.major} onInput={(e) => setForm({ ...form, major: e.detail.value })} />
            </View>
            <Textarea
              className="admTextarea"
              value={form.reason}
              maxlength={200}
              placeholder="请填写修改原因（将写入操作日志）"
              onInput={(e) => setForm({ ...form, reason: e.detail.value })}
            />
            <View className="admModalActions">
              <View className="admActionBtn">
                <View className="admBtn admBtnGhost" style={{ height: '88rpx' }} onClick={() => setEditing(false)}>
                  <Text>取消</Text>
                </View>
              </View>
              <View className="admActionBtn">
                <View className="admBtn admBtnDanger" style={{ height: '88rpx' }} onClick={saveRealName}>
                  <Text>{saving ? '保存中…' : '确认修改'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
