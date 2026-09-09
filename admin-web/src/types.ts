// 与各管理云函数返回结构对应的前端类型（消费子集）

export interface OrderDemand {
  id?: string;
  grade?: string;
  subject?: string;
  category?: string;
  title?: string;
  budget?: string;
  area?: string;
  gender?: string;
}

export interface OrderTeacher {
  name?: string;
  school?: string;
  subject?: string;
  rate?: string;
  verified?: boolean;
}

export interface OrderParent {
  nickname?: string;
  phone?: string;
  area?: string;
}

export interface OrderRow {
  id: string;
  demandId?: string;
  teacherId?: string;
  status: string;
  confirmedAt?: string | null;
  createTime?: string | null;
  cancelTime?: string | null;
  demand?: OrderDemand;
  teacher?: OrderTeacher;
  parent?: OrderParent;
}

export interface DeliveryDemand {
  id?: string;
  grade?: string;
  subject?: string;
  category?: string;
  title?: string;
  area?: string;
  budget?: string;
  gender?: string;
  classTime?: string;
  note?: string;
}

export interface DeliveryTeacher {
  name?: string;
  school?: string;
  subject?: string;
  rate?: string;
  verified?: boolean;
}

export interface DeliveryRow {
  id: string;
  type?: string;
  status?: string;
  demandId?: string;
  teacherId?: string;
  createTime?: string | null;
  orderStatus?: string | null;
  recommended?: boolean;
  riskNote?: string;
  demand?: DeliveryDemand;
  teacher?: DeliveryTeacher;
  parent?: { nickname?: string; phone?: string };
}

export interface DemandRow {
  id: string;
  docId?: string;
  status?: string;
  grade?: string;
  subject?: string;
  category?: string;
  title?: string;
  budget?: string;
  area?: string;
  gender?: string;
  classTime?: string;
  desc?: string;
  createTime?: string | null;
  applicants?: number;
  parent?: { nickname?: string; phone?: string };
}

export interface ApplicationRow {
  id: string;
  teacherId?: string;
  openid?: string;
  demandId?: string;
  status?: string;
  verified?: boolean;
  rate?: string;
  rateByStage?: unknown;
  createTime?: string | null;
  teacher?: { name?: string; school?: string; subject?: string };
  demand?: { grade?: string; subject?: string; title?: string; area?: string; budget?: string };
}

export interface TeacherResume {
  id?: string;
  openid?: string;
  name?: string;
  gender?: string;
  avatar?: string;
  school?: string;
  major?: string;
  degree?: string;
  verified?: boolean;
  verificationStatus?: string;
  authorized?: boolean;
  subjects?: string[];
  grades?: string[];
  timeSlots?: string[];
  districts?: string[];
  rate?: string;
  rateByStage?: Record<string, string> | null;
  intro?: string;
  years?: string;
  source?: string;
}

export interface VerifyMaterial {
  name?: string;
  fileID?: string;
  url?: string; // 云存储临时可预览地址
  text?: string; // 旧版纯文本材料说明
}

export interface VerifyRow {
  id: string;
  openid?: string;
  name?: string;
  school?: string;
  authorized?: boolean;
  materials?: VerifyMaterial[];
  status?: string;
  rejectReason?: string;
  createTime?: string | null;
}

export interface FeeRow {
  id: string;
  orderId?: string;
  status: string;
  totalFee?: number;
  fee?: number;
  calcMode?: string;
  note?: string;
  registeredBy?: string;
  demandId?: string;
  teacherId?: string;
  demand?: string;
  teacherName?: string;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface DashData {
  operator?: { username?: string; level?: string };
  demands?: number;
  activeDemands?: number;
  applications?: number;
  matches?: Record<string, number>;
  verifications?: Record<string, number>;
  inquiries?: Record<string, number>;
  fee?: { 待付?: number; 待付金额?: number; 已付?: number };
  users?: { teacher?: number; parent?: number };
}
