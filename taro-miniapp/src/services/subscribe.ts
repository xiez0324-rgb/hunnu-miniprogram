import Taro from '@tarojs/taro'
import { SUBSCRIBE_CONFIG, type SubscribeEventDef } from '@/constants/subscribe'

export type RequestResult = 'accept' | 'reject' | 'ban' | 'filter' | 'error'

// 订阅权限申请（一次性订阅：用户点一次「允许」只授权发送一条，符合微信规则）
export async function requestSubscribe(tmplIds: string[]): Promise<Record<string, RequestResult>> {
  const out: Record<string, RequestResult> = {}
  const valid = (tmplIds || []).filter((id) => typeof id === 'string' && id.length > 0)
  if (process.env.TARO_ENV !== 'weapp' || valid.length === 0) {
    // 非小程序端 / 尚未配置模板：返回空对象，由调用方引导
    return out
  }
  try {
    const api = (Taro as unknown as {
      requestSubscribeMessage: (opts: { tmplIds: string[] }) => Promise<Record<string, string>>
    }).requestSubscribeMessage
    const res = await api({ tmplIds: valid })
    for (const id of valid) {
      const raw = res[id]
      if (raw === 'accept') out[id] = 'accept'
      else if (raw === 'reject') out[id] = 'reject'
      else if (raw === 'ban') out[id] = 'ban'
      else if (raw === 'filter') out[id] = 'filter'
      else out[id] = 'error'
    }
  } catch (err) {
    console.warn('[Subscribe] requestSubscribeMessage 失败：', err)
  }
  return out
}

export function getRoleEvents(role: 'parent' | 'teacher'): SubscribeEventDef[] {
  return SUBSCRIBE_CONFIG[role] || []
}

export function eventById(role: 'parent' | 'teacher', key: string): SubscribeEventDef | undefined {
  return (SUBSCRIBE_CONFIG[role] || []).find((e) => e.key === key)
}

// 事件文案映射（供站内信展示用）
export const EVENT_TITLES: Record<string, string> = {
  parent_demand_published: '信息提交成功',
  parent_new_applicant: '有人报名',
  parent_recommended: '已推荐人选',
  teacher_new_demand: '新需求上架',
  teacher_recommended: '报名被推荐',
  teacher_confirmed: '家长确认成交',
}
