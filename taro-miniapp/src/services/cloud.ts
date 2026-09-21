import Taro from '@tarojs/taro'
import applyDemand from '@/data/applyDemand'
import cancelApplication from '@/data/cancelApplication'
import cancelConfirm from '@/data/cancelConfirm'
import confirmMatch from '@/data/confirmMatch'
import createDemand from '@/data/createDemand'
import getApplicants from '@/data/getApplicants'
import getDemandDetail from '@/data/getDemandDetail'
import getDemands from '@/data/getDemands'
import getMyData from '@/data/getMyData'
import getMyResume from '@/data/getMyResume'
import getMyVerification from '@/data/getMyVerification'
import getNotices from '@/data/getNotices'
import getProfile from '@/data/getProfile'
import getTeacherDetail from '@/data/getTeacherDetail'
import login from '@/data/login'
import requestTeacherInfo from '@/data/requestTeacherInfo'
import saveResume from '@/data/saveResume'
import submitVerification from '@/data/submitVerification'
import updateProfile from '@/data/updateProfile'
import adminMocks from '@/data/adminMocks'

const isWeapp = process.env.TARO_ENV === 'weapp'

// 静态引入所有 mock（仅非小程序环境 / H5 预览使用）
const mockModules: Record<string, (data?: any) => any> = {
  // 管理后台 admin* 云函数（对象展开注册：adminLogin/adminDashboard/adminList* 等）
  ...adminMocks,
  applyDemand, cancelApplication, cancelConfirm, confirmMatch, createDemand,
  getApplicants, getDemandDetail, getDemands, getMyData,
  getMyResume, getMyVerification, getNotices, getProfile, getTeacherDetail, login, requestTeacherInfo, saveResume,
  submitVerification, updateProfile,
}

function loadMock<T>(name: string, data?: Record<string, any>): T {
  const fn = mockModules[name]
  if (!fn) {
    console.warn(`[Cloud] 未找到 mock 模块: ${name}`)
    return {} as T
  }
  return fn(data) as T
}

export async function callFunction<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<T> {
  // 非小程序环境（H5 预览）直接使用 mock 数据
  if (!isWeapp) {
    return loadMock<T>(name, data)
  }
  // 小程序环境：始终调用真实云函数，失败直接抛错由页面提示。
  // 注意：不要在此静默降级 mock —— 否则会出现「报名/发布显示成功，
  // 但云端无留痕」的假象（一次云调用失败会永久污染后续所有调用）。
  try {
    const res = await Taro.cloud.callFunction({ name, data })
    const result = res.result as { code: number; message: string; data: T }
    if (result.code !== 0) {
      throw new Error(result.message || '请求失败')
    }
    return result.data
  } catch (err) {
    console.error(`[Cloud] ${name} 调用失败:`, err)
    throw err
  }
}

export function getDatabase() {
  if (!isWeapp) {
    return null
  }
  return Taro.cloud.database()
}
