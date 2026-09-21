// 用户角色
export type Role = 'parent' | 'teacher'

// 用户信息
export interface UserInfo {
  openid: string
  nickname: string
  avatar: string
  role: Role
  phone: string
  gender?: UserGender
  area?: string
  // 老师专属 5 位编号（认证通过后颁发，暂无为空）
  teacherNo?: string
}

// 用户性别（个人信息档案专用：仅 男/女 两态）
export type UserGender = '男' | '女'

// 个人信息档案（users 集合，按 _openid 隔离，仅本人可读写）
export interface Profile {
  nickname: string
  gender?: UserGender
  phone: string
  wechat: string
  area: string
  role: Role
  // 老师专属 5 位编号与认证状态
  teacherNo?: string
  verified?: boolean
}

// 需求状态
export type DemandStatus = '进行中' | '已成交' | '已下架'

// 需求类别
export type DemandCategory = '主科' | '体育' | '艺术' | '编程'

// 偏好性别
export type Gender = '男' | '女' | '不限'

// 需求单
export interface Demand {
  _id: string
  id: string
  grade: string
  subject: string
  category: DemandCategory
  title: string
  goal: string
  time: string
  budget: string
  area: string
  gender: Gender
  phone: string
  note: string
  applicants: number
  recommended: number
  status: DemandStatus
  /** 内容审核状态（先审后发）：待审核 / 已通过 / 已驳回 */
  auditStatus?: '待审核' | '已通过' | '已驳回'
  rejectReason?: string
  createTime: string
  applied?: boolean
  /** 家长已确认的老师（持久化状态，用于「查看报名进度」回显与禁用重复确认） */
  confirmedTeacherId?: string
  confirmedTeacherName?: string
  confirmedTime?: string
}

// 报名状态
export type ApplicationStatus = '已报名' | '已推荐' | '已确认' | '已成交' | '已取消'

// 报名记录
export interface Application {
  id: string
  demandId: string
  title: string
  budget: string
  meta: string
  status: ApplicationStatus
  createTime: string
}

// 老师
export interface Teacher {
  id: string
  name: string
  school: string
  // 合作院校固定（湖南师范大学），前端不展示学校名；身份行统一展示「学院 · 专业」。
  // 旧数据可能无 college/major，前端会解析 school 后缀作兼容展示。
  college?: string
  major?: string
  subject: string
  rate: string
  meta: string
  quote: string
  verified: boolean
  // 性别（简历基础信息板块展示，与年龄/籍贯等身份信息同排版）
  gender?: string
  // 实名学籍认证通过后颁发的唯一 5 位数字编号（家长端简历可见）
  teacherNo?: string
}

// 报名人选（确认人选页）
export interface Applicant extends Teacher {
  recommended: boolean
  // 该老师在该需求下的报名状态（用于识别「已确认」人选）
  status?: ApplicationStatus
}

// 分学段时薪区间（键为学段：小学/初中/高中，值为 'min-max' 字符串）
export interface StageRates {
  小学?: string
  初中?: string
  高中?: string
}

// 简历
export interface Resume {
  subjects: string[]
  grades: string[]
  timeSlots: string[]
  rate: string
  // 多学段分档薪资（可选）：配置后家长端优先展示分档；未配置时回退用 rate
  rateByStage?: StageRates
  districts: string[]
  intro: string
  // 教龄（如「1-3 年」）：老师端简历页录入，家长端「教学经历」展示
  teachingYears?: string
  // 家教/工作经历（自由文本）：老师端简历页录入，家长端「教学经历」展示
  experience?: string
  // 资质证书（如「英语专八」「教师资格证」）：老师端简历页录入，家长端以标签展示
  certificates?: string[]
}

// 认证
export type VerifyStatus = '待审核' | '已通过' | '已驳回'

// 认证材料（新提交为对象；历史遗留可能为纯文本说明，做兼容展示）
export type VerifyMaterial = { name: string; fileID: string } | string

export interface Verification {
  name: string
  school: string
  // 学院 / 专业：学籍认证时录入，作为老师卡与简历页的身份展示（前端不展示学校名）
  college?: string
  major?: string
  materials: VerifyMaterial[]
  status: VerifyStatus
  authorized: boolean
  rejectReason: string
}
