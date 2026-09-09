import type { Demand, Teacher, Applicant, Application, FeeRecord, Resume } from '@/types'

// 长沙服务区域（发布需求滑动选项卡）
export const districts = [
  '岳麓区',
  '芙蓉区',
  '天心区',
  '开福区',
  '雨花区',
  '望城区',
  '长沙县',
]

// 需求广场可展开的全部科目（覆盖语数外及副科 + 兴趣课）
export const allSubjects = [
  '语文',
  '数学',
  '英语',
  '物理',
  '化学',
  '生物',
  '历史',
  '地理',
  '政治',
  '音乐',
  '美术',
  '少儿编程',
  '羽毛球',
  '篮球',
  '足球',
  '钢琴',
]

// 老师端快速分类（顺序固定：体育 / 艺术 / 编程 / 全部）
export const quickChips = ['体育', '艺术', '编程', '全部']

// 简历可授课科目（覆盖高中全科）
export const resumeSubjects = [
  '语文',
  '数学',
  '英语',
  '物理',
  '化学',
  '生物',
  '历史',
  '地理',
  '政治',
]

// 偏好老师性别
export const genders = ['不限', '男', '女']

// 期望时段（固定选项，另有自填时间）
export const timeSlotOptions = ['周一至周五', '周六', '周末']

// 预算类型
export const budgetTypes = ['预算范围', '预算固定']

// 平台代理人（Kiki）客服微信号：正式运营前请替换为真实对外客服号
export const agentWechat = 'kiki-jiajiao-demo'

export const demands: Demand[] = [
  {
    _id: 'd1024',
    id: '1024',
    grade: '初三',
    subject: '数学',
    category: '主科',
    title: '中考冲刺提分',
    goal: '中考冲刺提分',
    time: '周六 / 周日 14:00-16:00',
    budget: '100-150 元/时',
    area: '岳麓区 · 师大附近',
    gender: '不限',
    phone: '138****1201',
    note: '学生基础中等，需要耐心讲解',
    applicants: 3,
    recommended: 1,
    status: '进行中',
    createTime: '2026-08-30 10:24',
  },
  {
    _id: 'd1025',
    id: '1025',
    grade: '五年级',
    subject: '数学',
    category: '主科',
    title: '小学奥数培优',
    goal: '培优拔高',
    time: '周三、周五 18:30-20:00',
    budget: '80-120 元/时',
    area: '岳麓区 · 湖大附近',
    gender: '女',
    phone: '139****5520',
    note: '希望老师风格活泼',
    applicants: 5,
    recommended: 2,
    status: '进行中',
    createTime: '2026-08-30 09:47',
  },
  {
    _id: 'd1026',
    id: '1026',
    grade: '高二',
    subject: '英语',
    category: '主科',
    title: '英语阅读专项',
    goal: '阅读与写作提分',
    time: '周日全天可约',
    budget: '120-160 元/时',
    area: '开福区 · 五一广场',
    gender: '男',
    phone: '137****3399',
    note: '口语基础较弱',
    applicants: 2,
    recommended: 0,
    status: '进行中',
    createTime: '2026-08-29 21:05',
  },
  {
    _id: 'd1027',
    id: '1027',
    grade: '四年级',
    subject: '少儿编程',
    category: '编程',
    title: '图形化编程启蒙',
    goal: 'Scratch 入门与逻辑思维',
    time: '周三、周五 19:00-20:30',
    budget: '90-130 元/时',
    area: '开福区 · 北辰三角洲',
    gender: '不限',
    phone: '135****8890',
    note: '零基础，希望老师有耐心',
    applicants: 4,
    recommended: 1,
    status: '进行中',
    createTime: '2026-08-29 18:20',
  },
  {
    _id: 'd1028',
    id: '1028',
    grade: '六年级',
    subject: '羽毛球',
    category: '体育',
    title: '羽毛球基础训练',
    goal: '零基础入门，掌握基本步法',
    time: '周六 9:00-11:00',
    budget: '80-120 元/时',
    area: '岳麓区 · 大学城体育馆',
    gender: '男',
    phone: '136****2210',
    note: '孩子个子高，体力好',
    applicants: 2,
    recommended: 0,
    status: '进行中',
    createTime: '2026-08-29 16:40',
  },
  {
    _id: 'd1029',
    id: '1029',
    grade: '三年级',
    subject: '钢琴',
    category: '艺术',
    title: '钢琴启蒙陪练',
    goal: '识谱与基础指法',
    time: '周六 15:00-16:00',
    budget: '100-150 元/时',
    area: '芙蓉区 · 湖南大剧院附近',
    gender: '女',
    phone: '134****7705',
    note: '家中有钢琴',
    applicants: 1,
    recommended: 0,
    status: '进行中',
    createTime: '2026-08-28 11:03',
  },
]

export const teachers: Teacher[] = [
  {
    id: 't1',
    name: '王晨',
    school: '湖南师范大学',
    college: '数学与统计学院',
    major: '数学与应用数学',
    subject: '数学',
    rate: '120 元/时',
    meta: '初三 · 一对一',
    quote: '讲解特别有耐心，孩子进步明显。',
    verified: true,
  },
  {
    id: 't2',
    name: '李思',
    school: '湖南师范大学',
    college: '外国语学院',
    major: '英语',
    subject: '英语',
    rate: '110 元/时',
    meta: '初三 · 小班',
    quote: '阅读方法讲得很系统。',
    verified: true,
  },
  {
    id: 't3',
    name: '刘洋',
    school: '湖南师范大学',
    college: '信息科学与工程学院',
    major: '计算机科学与技术',
    subject: '少儿编程',
    rate: '130 元/时',
    meta: '四年级 · 一对一',
    quote: '带孩子做项目很有方法。',
    verified: true,
  },
  {
    id: 't4',
    name: '赵敏',
    school: '湖南师范大学',
    college: '体育学院',
    major: '体育教育',
    subject: '羽毛球',
    rate: '100 元/时',
    meta: '六年级 · 一对二',
    quote: '羽毛球国家二级运动员。',
    verified: false,
  },
  {
    id: 't5',
    name: '陈晨',
    school: '湖南师范大学',
    college: '音乐学院',
    major: '音乐表演',
    subject: '钢琴',
    rate: '140 元/时',
    meta: '三年级 · 上门',
    quote: '钢琴十级，擅长陪练启蒙。',
    verified: true,
  },
  {
    id: 't6',
    name: '周杰',
    school: '湖南师范大学',
    college: '数学与统计学院',
    major: '数学与应用数学',
    subject: '数学',
    rate: '110 元/时',
    meta: '初三 · 一对一',
    quote: '带过两届中考冲刺。',
    verified: false,
  },
]

// 各需求单报名老师：recommended 标记是否平台推荐（家长端置顶）
export const applicantsByDemand: Record<string, Applicant[]> = {
  '1024': [
    { ...teachers[0]!, recommended: true },
    { ...teachers[5]!, recommended: false },
    { ...teachers[1]!, recommended: false },
  ],
  '1025': [
    { ...teachers[1]!, recommended: true },
    { ...teachers[2]!, recommended: false },
    { ...teachers[0]!, recommended: false },
  ],
  '1026': [
    { ...teachers[1]!, recommended: false },
    { ...teachers[0]!, recommended: false },
  ],
  '1027': [
    { ...teachers[2]!, recommended: true },
    { ...teachers[5]!, recommended: false },
  ],
  '1028': [
    { ...teachers[3]!, recommended: false },
    { ...teachers[2]!, recommended: false },
  ],
  '1029': [
    { ...teachers[4]!, recommended: false },
  ],
}

// 老师端我的报名
export const myApplies: Application[] = [
  {
    id: 'a1',
    demandId: '1024',
    title: '初三 · 数学',
    budget: '100-150 元/时',
    meta: '周六 · 师大附近',
    status: '已推荐',
    createTime: '2026-08-30 12:00',
  },
  {
    id: 'a2',
    demandId: '1025',
    title: '五年级 · 数学',
    budget: '80-120 元/时',
    meta: '周三周五晚 · 湖大附近',
    status: '已报名',
    createTime: '2026-08-30 11:20',
  },
  {
    id: 'a3',
    demandId: '1026',
    title: '高二 · 英语',
    budget: '120-160 元/时',
    meta: '周日 · 五一广场',
    status: '已成交',
    createTime: '2026-08-28 15:40',
  },
  {
    id: 'a4',
    demandId: '1027',
    title: '四年级 · 少儿编程',
    budget: '90-130 元/时',
    meta: '周三周五晚 · 北辰三角洲',
    status: '已报名',
    createTime: '2026-08-29 19:10',
  },
]

// 费用状态记录（演示数据：不含金额，金额仅管理员后台可见）
export const feeRecords: FeeRecord[] = [
  {
    id: 'f1',
    demand: '#1026 高二 · 英语',
    status: '待付',
  },
  {
    id: 'f2',
    demand: '#1012 初三 · 数学',
    status: '已付',
  },
]

// 老师完整简历（家长端查看）
export const teacherResumes: Record<string, Resume> = {
  t1: {
    subjects: ['数学'],
    grades: ['初中', '高中'],
    timeSlots: ['周一至周五', '周六', '周末'],
    rate: '120 元/时',
    rateByStage: { 初中: '110-130', 高中: '130-150' },
    districts: ['岳麓区', '芙蓉区'],
    intro: '数学与应用数学专业大三，带过 3 届中考冲刺，学员平均提分 20+，擅长基础薄弱学生的查漏补缺，讲解耐心有方法。',
  },
  t2: {
    subjects: ['英语'],
    grades: ['小学', '初中', '高中'],
    timeSlots: ['周六', '周末'],
    rate: '110 元/时',
    districts: ['岳麓区', '开福区'],
    intro: '英语专业大四，英语专八，辅导英语阅读与写作提分明显，曾带初三学生从 70 分提至 105 分。',
  },
  t3: {
    subjects: ['少儿编程'],
    grades: ['小学', '初中'],
    timeSlots: ['周一至周五', '周六'],
    rate: '130 元/时',
    districts: ['岳麓区', '开福区', '芙蓉区'],
    intro: '计算机科学与技术专业，Scratch/Python 少儿编程教学 2 年，带孩子完成多个小项目，注重逻辑思维培养。',
  },
  t4: {
    subjects: ['羽毛球'],
    grades: ['小学', '初中'],
    timeSlots: ['周六', '周末'],
    rate: '100 元/时',
    districts: ['岳麓区'],
    intro: '体育教育专业，国家二级运动员，擅长羽毛球零基础教学与步法训练，带过校队青少年队员。',
  },
  t5: {
    subjects: ['钢琴'],
    grades: ['小学'],
    timeSlots: ['周六', '周末'],
    rate: '140 元/时',
    districts: ['芙蓉区', '岳麓区'],
    intro: '音乐表演专业（钢琴方向），钢琴十级，3 年陪练启蒙经验，擅长识谱与基础指法教学，孩子喜欢、家长放心。',
  },
  t6: {
    subjects: ['数学'],
    grades: ['初中', '高中'],
    timeSlots: ['周一至周五', '周末'],
    rate: '110 元/时',
    districts: ['岳麓区', '天心区'],
    intro: '数学与应用数学专业研究生，带过两届中考冲刺与高一衔接，逻辑清晰，能帮助学生建立数学思维体系。',
  },
}
