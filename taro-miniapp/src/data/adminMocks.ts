// 管理后台 admin* 云函数的 H5 预览 mock（与云函数返回结构保持一致，字段名/类型对齐 types/admin）
// 说明：仅非小程序环境（H5 预览）使用；微信小程序端调用真实 admin* 云函数。
// 图片一律使用 picsum 占位图（符合模板 mock 规范：不使用本地资源）。
import type { DeliveryRow } from '@/types/admin'

// ============ 基础种子数据 ============

interface Pic {
  name: string
  url: string
}

const mk = (id: number, w = 600, h = 800): Pic => ({ name: `材料图${id}`, url: `https://picsum.photos/id/${id}/${w}/${h}` })

const demos = [
  {
    id: 'd1001',
    docId: 'doc1001',
    status: '进行中',
    grade: '小学',
    subject: '语文',
    category: '主科',
    title: '麓山名园 · 四年级语文陪伴学习',
    budget: '100',
    area: '岳麓区·麓山名园',
    gender: '不限',
    classTime: '周二/周四 19:00-21:00',
    desc: '孩子四年级，阅读理解与作文偏弱，希望老师有耐心、能陪伴课后作业与阅读练习。',
    createTime: new Date(Date.now() - 86400000 * 6).toISOString(),
    applicants: 2,
    parent: { nickname: '李女士', phone: '13800001001' },
  },
  {
    id: 'd1002',
    docId: 'doc1002',
    status: '进行中',
    grade: '初中',
    subject: '数学',
    category: '主科',
    title: '荣泰广场 · 初一数学提升',
    budget: '120',
    area: '岳麓区·荣泰广场',
    gender: '女',
    classTime: '周末上午',
    desc: '初一女生，基础尚可，希望提前学习下学期内容并巩固压轴题思路。',
    createTime: new Date(Date.now() - 86400000 * 4).toISOString(),
    applicants: 1,
    parent: { nickname: '周先生', phone: '13800001002' },
  },
  {
    id: 'd1003',
    docId: 'doc1003',
    status: '已成交',
    grade: '高中',
    subject: '物理',
    category: '主科',
    title: '梅溪湖 · 高二物理强化',
    budget: '150',
    area: '岳麓区·梅溪湖国际新城',
    gender: '男',
    classTime: '周六 14:00-16:00',
    desc: '高二选考物理，电学部分吃力，需要系统梳理知识点。',
    createTime: new Date(Date.now() - 86400000 * 12).toISOString(),
    applicants: 3,
    parent: { nickname: '刘先生', phone: '13800001003' },
  },
  {
    id: 'd1004',
    docId: 'doc1004',
    status: '进行中',
    grade: '小学',
    subject: '英语',
    category: '主科',
    title: '天马小区 · 三年级英语启蒙',
    budget: '90',
    area: '岳麓区·天马小区',
    gender: '女',
    classTime: '周一/周五 18:30-20:00',
    desc: '培养英语兴趣与语感，希望课堂活泼一些。',
    createTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    applicants: 1,
    parent: { nickname: '张女士', phone: '13800001004' },
  },
  {
    id: 'd1005',
    docId: 'doc1005',
    status: '已成交',
    grade: '初中',
    subject: '化学',
    category: '主科',
    title: '保利麓谷 · 初三化学冲刺',
    budget: '130',
    area: '岳麓区·保利麓谷林语',
    gender: '不限',
    classTime: '周日 09:00-11:00',
    desc: '初三备战中考，化学实验与推断题专项突破。',
    createTime: new Date(Date.now() - 86400000 * 20).toISOString(),
    applicants: 2,
    parent: { nickname: '王先生', phone: '13800001005' },
  },
  {
    id: 'd1006',
    docId: 'doc1006',
    status: '已下架',
    grade: '小学',
    subject: '数学',
    category: '主科',
    title: '湖南师大附小 · 数学培优',
    budget: '100',
    area: '岳麓区·湖南师大附小周边',
    gender: '不限',
    classTime: '协商',
    desc: '已找到合适老师，需求下架。',
    createTime: new Date(Date.now() - 86400000 * 30).toISOString(),
    applicants: 1,
    parent: { nickname: '陈女士', phone: '13800001006' },
  },
]

// 老师（报名/投递/订单共用，teacherId t_ 前缀 = 真实报名老师，不在 teachers 种子表）
const teachers: Record<
  string,
  { name: string; gender?: string; teacherNo?: string; phone?: string; college?: string; major?: string; subject?: string; rate?: string; verified?: boolean }
> = {
  t1001: { name: '陈老师', gender: '男', teacherNo: '10001', phone: '13500001001', college: '数学与统计学院', major: '数学与应用数学', subject: '语文/数学', rate: '100', verified: true },
  t1002: { name: '林老师', gender: '女', teacherNo: '10002', phone: '13500001002', college: '数学与统计学院', major: '数学与应用数学', subject: '数学', rate: '120', verified: true },
  t1003: { name: '郑老师', gender: '男', teacherNo: '10003', phone: '13500001003', college: '物理与电子科学学院', major: '物理学', subject: '物理', rate: '150', verified: true },
  t1004: { name: '吴老师', gender: '女', teacherNo: '10004', phone: '13500001004', college: '外国语学院', major: '英语', subject: '英语', rate: '90', verified: true },
  t1005: { name: '唐老师', gender: '女', teacherNo: '10005', phone: '13500001005', college: '化学化工学院', major: '化学', subject: '化学', rate: '130', verified: true },
  t1006: { name: '何老师', gender: '男', phone: '13500001006', college: '文学院', major: '汉语言文学', subject: '语文', rate: '95', verified: false },
}

const orders = [
  {
    id: 'o3001',
    demandId: 'd1002',
    teacherId: 't1002',
    status: '待联系',
    confirmedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    createTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    demand: { ...demos[1], parent: undefined },
    teacher: teachers.t1002,
    parent: demos[1].parent,
  },
  {
    id: 'o3002',
    demandId: 'd1001',
    teacherId: 't1001',
    status: '待联系',
    confirmedAt: new Date(Date.now() - 86400000).toISOString(),
    createTime: new Date(Date.now() - 86400000).toISOString(),
    demand: { ...demos[0], parent: undefined },
    teacher: teachers.t1001,
    parent: demos[0].parent,
  },
  {
    id: 'o3003',
    demandId: 'd1004',
    teacherId: 't1004',
    status: '已联系',
    confirmedAt: new Date(Date.now() - 86400000 * 1.5).toISOString(),
    createTime: new Date(Date.now() - 86400000 * 2.5).toISOString(),
    demand: { ...demos[3], parent: undefined },
    teacher: teachers.t1004,
    parent: demos[3].parent,
  },
  {
    id: 'o3004',
    demandId: 'd1003',
    teacherId: 't1003',
    status: '已成交',
    confirmedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    createTime: new Date(Date.now() - 86400000 * 9).toISOString(),
    demand: { ...demos[2], parent: undefined },
    teacher: teachers.t1003,
    parent: demos[2].parent,
  },
  {
    id: 'o3005',
    demandId: 'd1005',
    teacherId: 't1005',
    status: '已成交',
    confirmedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    createTime: new Date(Date.now() - 86400000 * 16).toISOString(),
    demand: { ...demos[4], parent: undefined },
    teacher: teachers.t1005,
    parent: demos[4].parent,
  },
  {
    id: 'o3006',
    demandId: 'd1002',
    teacherId: 't1006',
    status: '已取消',
    confirmedAt: new Date(Date.now() - 86400000 * 1.2).toISOString(),
    cancelTime: new Date(Date.now() - 86400000 * 0.8).toISOString(),
    createTime: new Date(Date.now() - 86400000 * 1.8).toISOString(),
    demand: { ...demos[1], parent: undefined },
    teacher: teachers.t1006,
    parent: demos[1].parent,
  },
]

const deliveryBase = (dIdx: number, tId: string, extra: Record<string, unknown>): DeliveryRow =>
  ({
    id: `dl${Math.floor(Math.random() * 1e6)}`,
    type: '投递',
    status: '已投递',
    demandId: demos[dIdx].id,
    createTime: new Date(Date.now() - 86400000 * (Math.floor(Math.random() * 10) + 1)).toISOString(),
    demand: demos[dIdx],
    parent: demos[dIdx].parent,
    teacher: teachers[tId],
    ...extra,
  } as DeliveryRow)

const deliveries = [
  deliveryBase(1, 't1002', { teacherId: 't1002', orderStatus: '待联系', recommended: true }),
  deliveryBase(0, 't1001', { teacherId: 't1001', orderStatus: '待联系', recommended: true }),
  deliveryBase(3, 't1004', { teacherId: 't1004', orderStatus: '已联系', recommended: false }),
  deliveryBase(2, 't1003', { teacherId: 't1003', orderStatus: '已成交', recommended: true }),
  deliveryBase(4, 't1005', { teacherId: 't1005', orderStatus: '已成交', recommended: true }),
  deliveryBase(1, 't1006', { teacherId: 't1006', orderStatus: '已取消', recommended: false }),
  deliveryBase(0, 't1006', { teacherId: 't1006', recommended: false, riskNote: '该老师近 1 小时报名/咨询频率异常，需人工复核身份后再推荐。' }),
  deliveryBase(4, 't1001', { teacherId: 't1001', recommended: false }),
  deliveryBase(5, 't1006', { teacherId: 't1006', recommended: false }),
  deliveryBase(3, 't1001', { teacherId: 't1001', recommended: true }),
]

const verifications = [
  {
    id: 'v5001',
    openid: 'openid_teacher_01',
    name: '陈老师',
    college: '数学与统计学院',
    major: '数学与应用数学',
    authorized: true,
    phone: '13500001001',
    materials: [
      { name: '学生证', url: mk(64).url, fileID: '' },
      { name: '学信网截图', url: mk(91).url, fileID: '' },
    ],
    status: '待审核',
    createTime: new Date(Date.now() - 86400000 * 0.6).toISOString(),
  },
  {
    id: 'v5002',
    openid: 'openid_teacher_02',
    name: '林老师',
    college: '数学与统计学院',
    major: '数学与应用数学',
    authorized: true,
    phone: '13500001002',
    materials: [
      { name: '学生证', url: mk(177).url, fileID: '' },
      { name: '学信网截图', url: mk(338).url, fileID: '' },
    ],
    status: '待审核',
    createTime: new Date(Date.now() - 86400000 * 0.4).toISOString(),
  },
  {
    id: 'v5003',
    openid: 'openid_teacher_03',
    name: '郑老师',
    college: '物理与电子科学学院',
    major: '物理学',
    authorized: false,
    phone: '13500001003',
    materials: [{ name: '学生证', url: mk(1025).url, fileID: '' }],
    status: '已通过',
    teacherNo: '10003',
    archived: true,
    createTime: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 'v5004',
    openid: 'openid_teacher_04',
    name: '历史遗留用户',
    materials: [{ text: '旧版登记：提交了学生证照片（无云存储记录）' }],
    status: '已驳回',
    rejectReason: '材料照片不清晰或与学籍信息不符，请重新上传',
    createTime: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
]

const applications = [
  {
    id: 'a7001',
    teacherId: 't1001',
    openid: 'openid_teacher_01',
    demandId: 'd1001',
    status: '已报名',
    verified: true,
    rate: '100',
    createTime: new Date(Date.now() - 86400000 * 5.5).toISOString(),
    teacher: teachers.t1001,
    demand: demos[0],
  },
  {
    id: 'a7002',
    teacherId: 't1002',
    openid: 'openid_teacher_02',
    demandId: 'd1002',
    status: '已确认',
    verified: true,
    rate: '120',
    createTime: new Date(Date.now() - 86400000 * 3.2).toISOString(),
    teacher: teachers.t1002,
    demand: demos[1],
  },
  {
    id: 'a7003',
    teacherId: 't1003',
    openid: 'openid_teacher_03',
    demandId: 'd1003',
    status: '已成交',
    verified: true,
    rate: '150',
    createTime: new Date(Date.now() - 86400000 * 10).toISOString(),
    teacher: teachers.t1003,
    demand: demos[2],
  },
  {
    id: 'a7004',
    teacherId: 't1006',
    openid: 'openid_teacher_04',
    demandId: 'd1001',
    status: '已取消',
    verified: false,
    rate: '95',
    createTime: new Date(Date.now() - 86400000 * 2.5).toISOString(),
    teacher: teachers.t1006,
    demand: demos[0],
  },
  {
    id: 'a7005',
    teacherId: 't1004',
    openid: 'openid_teacher_05',
    demandId: 'd1004',
    status: '已报名',
    verified: true,
    rate: '90',
    createTime: new Date(Date.now() - 86400000 * 1.6).toISOString(),
    teacher: teachers.t1004,
    demand: demos[3],
  },
]

const feeRecords = [
  {
    id: 'f9001',
    orderId: 'o3004',
    demandId: 'd1003',
    teacherId: 't1003',
    status: '已付',
    totalFee: 3600,
    fee: 216,
    calcMode: '按费率计算（6%）',
    demand: '高中 物理',
    teacherName: '郑老师',
    createTime: new Date(Date.now() - 86400000 * 7).toISOString(),
    updateTime: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'f9002',
    orderId: 'o3005',
    demandId: 'd1005',
    teacherId: 't1005',
    status: '已付',
    totalFee: 2600,
    fee: 156,
    calcMode: '按费率计算（6%）',
    demand: '初中 化学',
    teacherName: '唐老师',
    createTime: new Date(Date.now() - 86400000 * 14).toISOString(),
    updateTime: new Date(Date.now() - 86400000 * 13).toISOString(),
  },
  {
    id: 'f9003',
    orderId: 'o3001',
    demandId: 'd1002',
    teacherId: 't1002',
    status: '待付',
    totalFee: 2880,
    fee: 173,
    calcMode: '按费率计算（6%）',
    demand: '初中 数学',
    teacherName: '林老师',
    createTime: new Date(Date.now() - 86400000).toISOString(),
  },
]

// ============ mock 导出（键名 = 云函数名，值与 services/cloud.ts mock 协议一致） ============

function orderFilter(data: Record<string, any>) {
  const status = data?.status && data.status !== '全部' ? data.status : null
  const orderId = data?.orderId
  return orders.filter((o) => (!status || o.status === status) && (!orderId || o.id === orderId))
}

export default {
  adminLogin(data: Record<string, any>) {
    const username = String(data?.username || '').trim()
    const password = String(data?.password || '')
    if (!username || !password) throw new Error('请输入账号与密码')
    if (password.length < 6) throw new Error('账号或密码错误')
    return { token: `mock_admin_${Date.now()}`, username, level: 'admin' }
  },

  adminDashboard() {
    const pendingFee = feeRecords.filter((f) => f.status === '待付')
    const pendingAmount = pendingFee.reduce((s, f) => s + (f.fee || 0), 0)
    return {
      operator: { username: 'admin', level: 'admin' },
      demands: demos.length,
      activeDemands: demos.filter((d) => d.status === '进行中').length,
      demandAuditPending: 0,
      applications: applications.length,
      matches: orders.reduce<Record<string, number>>((m, o) => {
        m[o.status] = (m[o.status] || 0) + 1
        return m
      }, {}),
      verifications: verifications.reduce<Record<string, number>>((m, v) => {
        m[v.status || '待审核'] = (m[v.status || '待审核'] || 0) + 1
        return m
      }, {}),
      inquiries: { 待处理: 2, 已处理: 3 },
      fee: { 待付: pendingFee.length, 待付金额: pendingAmount, 已付: feeRecords.filter((f) => f.status === '已付').length },
      users: { teacher: 47, parent: 132 },
    }
  },

  adminListOrders(data?: Record<string, any>) {
    return { list: orderFilter(data || {}) }
  },

  adminUpdateOrder(data: Record<string, any>) {
    const target = orders.find((o) => o.id === data?.orderId)
    if (!target) throw new Error('订单不存在')
    target.status = String(data?.status || '')
    if (target.status === '已取消') target.cancelTime = new Date().toISOString()
    return { ok: true }
  },

  // 撤回订单（H5 mock）：仅未完成订单可撤回，撤回后置「已撤回」
  adminWithdrawOrder(data: Record<string, any>) {
    const target = orders.find((o) => o.id === data?.orderId)
    if (!target) throw new Error('订单不存在')
    if (target.status !== '待联系' && target.status !== '已联系') {
      throw new Error(`仅「待联系 / 已联系」的未完成订单可撤回（当前：${target.status}）`)
    }
    target.status = '已撤回'
    return { ok: true, to: '已撤回' }
  },

  adminListVerifications(data?: Record<string, any>) {
    const status = data?.status && data.status !== '全部' ? data.status : null
    const all = verifications.filter((v) => !status || v.status === status)
    // 与云函数一致：服务端 skip/limit 分页 + total/hasMore
    const skip = Math.max(0, Number(data?.skip) || 0)
    const limit = Math.min(200, Math.max(1, Number(data?.limit) || 100))
    const list = all.slice(skip, skip + limit)
    return { list, total: all.length, skip, limit, hasMore: skip + list.length < all.length }
  },

  adminReviewVerify(data: Record<string, any>) {
    const target = verifications.find((v) => v.id === data?.verificationId)
    if (!target) throw new Error('认证记录不存在')
    target.status = data?.action === '通过' ? '已通过' : '已驳回'
    if (target.status === '已驳回') target.rejectReason = String(data?.rejectReason || '材料照片不清晰或与学籍信息不符，请重新上传')
    return { ok: true }
  },

  adminListDeliveries() {
    return { list: deliveries }
  },

  adminRecommend(data: Record<string, any>) {
    const target = deliveries.find((d) => d.demandId === data?.demandId && d.teacherId === data?.teacherId)
    if (target) target.recommended = Boolean(data?.recommended)
    return { ok: true }
  },

  adminGetTeacherDetail(data: Record<string, any>) {
    const t = teachers[String(data?.teacherId)]
    if (!t) throw new Error('未找到该老师简历')
    return {
      teacher: {
        id: data?.teacherId,
        openid: `openid_${data?.teacherId}`,
        name: t.name,
        college: t.college,
        major: t.major,
        degree: '在读本科',
        gender: t.gender || '女',
        phone: t.phone || '',
        teacherNo: t.teacherNo || '',
        realNameLocked: !!t.teacherNo,
        verified: t.verified,
        verificationStatus: t.verified ? '已通过' : '未认证',
        authorized: true,
        subjects: t.subject ? [t.subject] : [],
        grades: ['小学', '初中', '高中'],
        timeSlots: ['周一至周五晚间', '周末全天'],
        districts: ['岳麓区'],
        rate: t.rate,
        rateByStage: null,
        intro: '耐心细致，讲解逻辑清晰，擅长把复杂知识点拆解成孩子易懂的步骤，注重课后巩固与错题复盘。',
        years: '2 年',
        source: '老师实名认证后自投递',
      },
    }
  },

  // 订单全局检索（H5 mock）：按需求单号 / 老师编号
  adminQueryOrder(data: Record<string, any>) {
    const type = data?.type === 'teacher' ? 'teacher' : 'demand'
    const keyword = String(data?.keyword || '').trim()
    const feeLabelOf = (list: Array<{ status?: string }>) => {
      if (!list.length) return '未登记'
      if (list.find((f) => f.status === '已付')) return '已付'
      if (list.find((f) => f.status === '待付')) return '待付'
      return list[0].status || '未登记'
    }

    if (type === 'teacher') {
      const tId = Object.keys(teachers).find((k) => teachers[k].teacherNo === keyword) || keyword
      const t = teachers[tId]
      if (!t) return { type: 'teacher', keyword, teacher: null, demands: [], orders: [], feeRecords: [] }
      const tApps = applications.filter((a) => a.teacherId === tId)
      const tOrders = orders.filter((o) => o.teacherId === tId)
      const tFees = feeRecords.filter((f) => f.teacherId === tId)
      return {
        type: 'teacher',
        keyword,
        teacher: {
          id: tId,
          openid: `openid_${tId}`,
          name: t.name,
          gender: t.gender || '',
          phone: t.phone || '',
          teacherNo: t.teacherNo || '',
          school: '湖南师范大学',
          college: t.college || '',
          major: t.major || '',
          verified: !!t.verified,
          realNameLocked: !!t.teacherNo,
          subjects: t.subject ? [t.subject] : [],
          grades: ['小学', '初中', '高中'],
          rate: t.rate || '',
          intro: '',
        },
        demands: tApps.map((a) => {
          const o = tOrders.find((x) => x.demandId === a.demandId)
          const fees = tFees.filter((f) => f.demandId === a.demandId)
          return {
            ...a.demand,
            applyStatus: a.status,
            orderStatus: o ? o.status : null,
            feeStatus: feeLabelOf(fees),
          }
        }),
        orders: tOrders,
        feeRecords: tFees,
      }
    }

    const d = demos.find((x) => x.id === keyword)
    if (!d) return { type: 'demand', keyword, demand: null, applicants: [], orders: [], feeRecords: [] }
    const dApps = applications.filter((a) => a.demandId === keyword)
    const dOrders = orders.filter((o) => o.demandId === keyword)
    const dFees = feeRecords.filter((f) => f.demandId === keyword)
    return {
      type: 'demand',
      keyword,
      demand: {
        id: d.id,
        grade: d.grade,
        subject: d.subject,
        category: d.category,
        title: d.title,
        budget: d.budget,
        area: d.area,
        gender: d.gender,
        classTime: d.classTime,
        note: d.desc,
        status: d.status,
        auditStatus: '已通过',
        createTime: d.createTime,
        orderStatus: dOrders.length ? dOrders.map((o) => o.status).join(' / ') : null,
        feeStatus: feeLabelOf(dFees),
        parent: d.parent,
      },
      applicants: dApps.map((a) => {
        const t = teachers[a.teacherId] || ({} as (typeof teachers)[string])
        const o = dOrders.find((x) => x.teacherId === a.teacherId)
        const fees = dFees.filter((f) => f.teacherId === a.teacherId)
        return {
          id: a.id,
          teacherId: a.teacherId,
          openid: a.openid,
          name: t.name || '',
          phone: t.phone || '',
          teacherNo: t.teacherNo || '',
          school: '湖南师范大学',
          college: t.college || '',
          major: t.major || '',
          subject: t.subject || '',
          rate: t.rate || '',
          verified: !!a.verified,
          status: a.status,
          createTime: a.createTime,
          orderStatus: o ? o.status : null,
          orderId: o ? o.id : null,
          feeStatus: feeLabelOf(fees),
          feeAmount: fees.reduce((s, f) => s + (Number(f.fee) || 0), 0),
        }
      }),
      orders: dOrders,
      feeRecords: dFees,
    }
  },

  // 合规修改老师实名档案（H5 mock）
  adminUpdateRealName(data: Record<string, any>) {
    const name = String(data?.name || '').trim()
    const college = String(data?.college || '').trim()
    const major = String(data?.major || '').trim()
    const reason = String(data?.reason || '').trim()
    if (!name || !college || !major) throw new Error('姓名/学院/专业均不能为空')
    if (!reason) throw new Error('合规修改必须填写修改原因')
    return { ok: true }
  },

  // 为历史已认证老师补发编号（H5 mock：无历史数据可补）
  assignTeacherNumbers() {
    return { assigned: 0, passed: verifications.filter((v) => v.status === '已通过').length }
  },

  adminListFeeRecords() {
    return { list: feeRecords }
  },

  adminRegisterFee(data: Record<string, any>) {
    const orderId = String(data?.orderId || '').trim()
    if (!orderId) throw new Error('请填写订单 ID')
    const exists = feeRecords.find((f) => f.orderId === orderId)
    const calcMode =
      data?.feeAmount != null
        ? '自定义金额'
        : data?.ratePercent != null
          ? `按费率计算（${data.ratePercent}%）`
          : '暂不计算（仅占位待付）'
    const totalFee = Number(data?.totalFee) || 0
    const fee = data?.feeAmount != null ? Number(data.feeAmount) : data?.ratePercent != null && totalFee > 0 ? Math.round(totalFee * (Number(data.ratePercent) / 100)) : 0
    const record = {
      id: exists ? exists.id : `f9${Math.floor(Math.random() * 1e4)}`,
      orderId,
      demandId: '',
      teacherId: '',
      status: String(data?.status || '待付'),
      totalFee,
      fee,
      calcMode,
      demand: '需求单',
      teacherName: '—',
      createTime: exists ? exists.createTime : new Date().toISOString(),
      updateTime: new Date().toISOString(),
    }
    if (exists) {
      const i = feeRecords.indexOf(exists)
      feeRecords[i] = record
    } else {
      feeRecords.unshift(record)
    }
    return { ok: true }
  },

  adminListDemands(data?: Record<string, any>) {
    const status = data?.status && data.status !== '全部' ? data.status : null
    const audit = data?.auditStatus && data.auditStatus !== '全部' ? data.auditStatus : null
    const list = demos
      .map((d) => ({ auditStatus: '已通过', ...d }))
      .filter((d) => (!status || d.status === status) && (!audit || d.auditStatus === audit))
    return { list }
  },

  adminReviewDemand(data: Record<string, any>) {
    const target = demos.find((d) => d.id === data?.demandId)
    if (!target) throw new Error('需求单不存在')
    const auditStatus = data?.action === '通过' ? '已通过' : '已驳回'
    ;(target as Record<string, any>).auditStatus = auditStatus
    return { ok: true, auditStatus }
  },

  adminListApplications() {
    return { list: applications }
  },

  adminChangePassword(data: Record<string, any>) {
    const oldPassword = String(data?.oldPassword || '')
    const newPassword = String(data?.newPassword || '')
    if (newPassword.length < 6) throw new Error('新密码至少 6 位')
    if (oldPassword && oldPassword.length < 6) throw new Error('旧密码不正确')
    return { ok: true }
  },
}
