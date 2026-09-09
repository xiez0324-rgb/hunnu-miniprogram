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
  createTime: string
  applied?: boolean
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
  subject: string
  rate: string
  meta: string
  quote: string
  verified: boolean
}

// 报名人选（确认人选页）
export interface Applicant extends Teacher {
  recommended: boolean
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
}

// 认证
export type VerifyStatus = '待审核' | '已通过' | '已驳回'

// 认证材料（新提交为对象；历史遗留可能为纯文本说明，做兼容展示）
export type VerifyMaterial = { name: string; fileID: string } | string

export interface Verification {
  name: string
  school: string
  materials: VerifyMaterial[]
  status: VerifyStatus
  authorized: boolean
  rejectReason: string
}

// 费用状态记录（普通用户可见项）：不含任何金额字段，金额仅在管理员端维护
export interface FeeRecord {
  id: string
  demand: string
  status: '待付' | '已付'
}
