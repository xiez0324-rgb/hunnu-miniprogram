// 管理后台数据类型（与各 admin* 云函数返回结构对应，消费子集）
// 说明：所有字段保持与 PC 管理后台（admin-web）对齐，保证同一云函数双端可用。

export interface AdminSession {
  token: string
  username: string
  level: string
}

export interface OrderDemand {
  id?: string
  grade?: string
  subject?: string
  category?: string
  title?: string
  budget?: string
  area?: string
  gender?: string
}

export interface OrderTeacher {
  name?: string
  school?: string
  college?: string
  major?: string
  subject?: string
  rate?: string
  verified?: boolean
  /** 老师完整联系电话（仅管理员可见，家长/老师端接口不下发） */
  phone?: string
  /** 认证通过后颁发的 5 位专属编号 */
  teacherNo?: string
}

export interface OrderParent {
  nickname?: string
  phone?: string
  area?: string
  wechat?: string
}

export interface OrderRow {
  id: string
  demandId?: string
  teacherId?: string
  status: string
  confirmedAt?: string | null
  createTime?: string | null
  cancelTime?: string | null
  demand?: OrderDemand
  teacher?: OrderTeacher
  parent?: OrderParent
}

export interface DeliveryDemand {
  id?: string
  grade?: string
  subject?: string
  category?: string
  title?: string
  area?: string
  budget?: string
  gender?: string
  classTime?: string
  note?: string
}

export interface DeliveryTeacher {
  name?: string
  school?: string
  college?: string
  major?: string
  subject?: string
  rate?: string
  verified?: boolean
  /** 老师完整联系电话（仅管理员可见） */
  phone?: string
  /** 认证通过后颁发的 5 位专属编号 */
  teacherNo?: string
}

export interface DeliveryParent {
  nickname?: string
  phone?: string
  wechat?: string
}

export interface DeliveryRow {
  id: string
  type?: string
  status?: string
  demandId?: string
  teacherId?: string
  createTime?: string | null
  orderStatus?: string | null
  recommended?: boolean
  riskNote?: string
  demand?: DeliveryDemand
  teacher?: DeliveryTeacher
  parent?: DeliveryParent
}

export interface DemandRow {
  id: string
  docId?: string
  status?: string
  auditStatus?: string
  rejectReason?: string
  grade?: string
  subject?: string
  category?: string
  title?: string
  budget?: string
  area?: string
  gender?: string
  classTime?: string
  desc?: string
  createTime?: string | null
  applicants?: number
  parent?: DemandParent
}

/** 需求单所属家长的联系信息（仅管理员可见；phone 优先取家长档案，缺失时回退需求单联系电话） */
export interface DemandParent {
  nickname?: string
  phone?: string
  wechat?: string
  area?: string
  /** 家长账号档案是否存在 */
  hasProfile?: boolean
  /** 电话是否来自需求单联系电话兜底（家长档案未填手机号） */
  fromDemand?: boolean
}

export interface ApplicationRow {
  id: string
  teacherId?: string
  openid?: string
  demandId?: string
  status?: string
  verified?: boolean
  rate?: string
  rateByStage?: unknown
  createTime?: string | null
  teacher?: { name?: string; school?: string; college?: string; major?: string; subject?: string; phone?: string; teacherNo?: string }
  demand?: { grade?: string; subject?: string; title?: string; area?: string; budget?: string }
  /** 该报名所属需求单的家长联系方式（仅管理员可见） */
  parent?: DemandParent
}

export interface TeacherResume {
  id?: string
  openid?: string
  name?: string
  gender?: string
  avatar?: string
  school?: string
  college?: string
  major?: string
  degree?: string
  verified?: boolean
  verificationStatus?: string
  authorized?: boolean
  /** 老师完整联系电话（仅管理员可见） */
  phone?: string
  /** 认证通过后颁发的 5 位专属编号 */
  teacherNo?: string
  /** 实名学籍档案是否已锁定（通过后不可由老师自行修改） */
  realNameLocked?: boolean
  subjects?: string[]
  grades?: string[]
  timeSlots?: string[]
  districts?: string[]
  rate?: string
  rateByStage?: Record<string, string> | null
  intro?: string
  years?: string
  source?: string
}

export interface VerifyMaterial {
  name?: string
  fileID?: string
  /** 云存储临时可预览地址（可能过期，前端可现场重新换取） */
  url?: string
  /** 旧版纯文本材料说明 */
  text?: string
}

export interface VerifyRow {
  id: string
  openid?: string
  name?: string
  school?: string
  college?: string
  major?: string
  authorized?: boolean
  materials?: VerifyMaterial[]
  status?: string
  rejectReason?: string
  createTime?: string | null
  /** 申请人联系电话（仅管理员可见，用于审核存疑时核实） */
  phone?: string
  /** 认证通过后颁发的 5 位专属编号 */
  teacherNo?: string
  /** 是否已固化为不可修改的正式档案（通过后为 true） */
  archived?: boolean
}

/** 认证列表分页结果（服务端 skip/limit 分页，支撑大量认证记录的稳定浏览） */
export interface VerifyPage {
  list: VerifyRow[]
  total?: number
  skip?: number
  limit?: number
  hasMore?: boolean
}

export interface FeeRow {
  id: string
  orderId?: string
  status: string
  totalFee?: number
  fee?: number
  calcMode?: string
  note?: string
  registeredBy?: string
  demandId?: string
  teacherId?: string
  demand?: string
  teacherName?: string
  createTime?: string | null
  updateTime?: string | null
}

export interface DashData {
  operator?: { username?: string; level?: string }
  demands?: number
  activeDemands?: number
  demandAuditPending?: number
  applications?: number
  matches?: Record<string, number>
  verifications?: Record<string, number>
  inquiries?: Record<string, number>
  fee?: { 待付?: number; 待付金额?: number; 已付?: number }
  users?: { teacher?: number; parent?: number }
}

// ============ 订单全局检索（adminQueryOrder）============

export interface QueryApplicant {
  id: string
  teacherId?: string
  openid?: string
  name?: string
  /** 老师完整联系电话（仅管理员可见） */
  phone?: string
  /** 认证通过后颁发的 5 位专属编号 */
  teacherNo?: string
  school?: string
  college?: string
  major?: string
  subject?: string
  rate?: string
  verified?: boolean
  /** 报名状态：已报名 / 已推荐 / 已确认 / 已成交 / 已取消 */
  status?: string
  createTime?: string | null
  /** 该组合关联订单状态（待联系/已联系/已成交/已取消/已撤回） */
  orderStatus?: string | null
  orderId?: string | null
  /** 信息费缴纳状态 */
  feeStatus?: string
  feeAmount?: number
}

export interface QueryDemand {
  id: string
  grade?: string
  subject?: string
  category?: string
  title?: string
  budget?: string
  area?: string
  gender?: string
  classTime?: string
  note?: string
  status?: string
  auditStatus?: string
  createTime?: string | null
  orderStatus?: string | null
  feeStatus?: string
  parent?: { nickname?: string; phone?: string; area?: string; wechat?: string }
  /** 按老师编号检索时：该老师在此需求下的报名状态 */
  applyStatus?: string
}

export interface QueryOrder {
  id: string
  demandId?: string
  teacherId?: string
  status?: string
  createTime?: string | null
  confirmedAt?: string | null
  cancelTime?: string | null
}

export interface QueryFeeRecord {
  id: string
  orderId?: string
  demandId?: string
  teacherId?: string
  status?: string
  totalFee?: number
  fee?: number
  createTime?: string | null
}

export interface QueryResult {
  type: 'demand' | 'teacher'
  keyword?: string
  demand?: QueryDemand | null
  teacher?: TeacherResume | null
  applicants?: QueryApplicant[]
  orders?: QueryOrder[]
  feeRecords?: QueryFeeRecord[]
  demands?: QueryDemand[]
}
