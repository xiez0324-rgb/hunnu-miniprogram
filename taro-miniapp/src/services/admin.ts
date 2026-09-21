// 管理后台会话与云调用封装（小程序端）
// 说明：
//  - 会话令牌存本地（admin_token / admin_user），所有 admin* 云函数调用统一携带 token，
//    由云端 requireAdmin 鉴权（与 PC 后台同一套协议，零云函数改动）。
//  - H5 预览 / 其它平台经 services/cloud.ts 自动走 admin mock 数据。

import Taro from '@tarojs/taro'
import { callFunction } from './cloud'

const TOKEN_KEY = 'admin_token'
const USER_KEY = 'admin_user'

export function getAdminToken(): string {
  try {
    return (Taro.getStorageSync(TOKEN_KEY) as string) || ''
  } catch (err) {
    return ''
  }
}

export function getAdminUser(): { username?: string; level?: string } {
  try {
    const raw = Taro.getStorageSync(USER_KEY)
    return raw && typeof raw === 'object' ? (raw as { username?: string; level?: string }) : {}
  } catch (err) {
    return {}
  }
}

export function isAdminAuthed(): boolean {
  return Boolean(getAdminToken())
}

export function setAdminSession(token: string, username: string, level: string) {
  try {
    Taro.setStorageSync(TOKEN_KEY, token)
    Taro.setStorageSync(USER_KEY, { username, level })
  } catch (err) {
    console.error('[Admin] 保存登录态失败', err)
  }
}

export function clearAdminSession() {
  try {
    Taro.removeStorageSync(TOKEN_KEY)
    Taro.removeStorageSync(USER_KEY)
  } catch (err) {
    console.error('[Admin] 清除登录态失败', err)
  }
}

/** 页面守卫：未登录则跳回管理登录页 */
export function guardAdminPage(): boolean {
  if (isAdminAuthed()) return true
  try {
    Taro.redirectTo({ url: '/pages/admin/login/index' })
  } catch (err) {
    /* 重复跳转忽略 */
  }
  return false
}

export function logoutAdmin() {
  clearAdminSession()
  try {
    Taro.redirectTo({ url: '/pages/admin/login/index' })
  } catch (err) {
    /* 忽略 */
  }
}

// ---- 读接口会话内短缓存（避免切换筛选反复全量拉取） ----
// 只缓存只读列表；写操作成功后显式 invalidateAdminCache 失效
const READ_FNS = new Set([
  'adminDashboard',
  'adminListOrders',
  'adminListVerifications',
  'adminListDeliveries',
  'adminListFeeRecords',
  'adminListDemands',
  'adminListApplications',
])
const CACHE_TTL = 30_000
const cacheStore = new Map<string, { expires: number; data: unknown }>()
const inflight = new Map<string, Promise<any>>()

function cacheKey(name: string, data: Record<string, unknown>) {
  return `${name}|${JSON.stringify(data)}`
}

export function invalidateAdminCache(name?: string) {
  if (!name) {
    cacheStore.clear()
    return
  }
  const prefix = `${name}|`
  for (const k of cacheStore.keys()) {
    if (k.startsWith(prefix)) cacheStore.delete(k)
  }
}

// ---- 登录态失效统一处理 ----
// 触发场景：同一管理员账号在其他设备重新登录（旧 token 被顶下线）、账号被停用、
// 本地 token 被清或伪造。云端 requireAdmin 一律返回「无管理员权限」，
// 前端在此统一清会话并引导重新登录，避免用户在各页面看到零散的报错却不知道原因。
const AUTH_ERROR_RE = /无管理员权限|管理员权限|FORBIDDEN/
let sessionExpiredHandling = false

function isAdminAuthError(err: unknown): boolean {
  const msg = (err as Error)?.message || ''
  return AUTH_ERROR_RE.test(msg)
}

function handleAdminSessionExpired() {
  if (sessionExpiredHandling) return
  sessionExpiredHandling = true
  clearAdminSession()
  Taro.showModal({
    title: '登录状态已失效',
    content: '该管理员账号可能已在其他设备登录，或账号已被停用。请重新登录后继续操作。',
    showCancel: false,
    confirmText: '重新登录',
    complete() {
      try {
        Taro.redirectTo({ url: '/pages/admin/login/index' })
      } catch (err) {
        /* 重复跳转忽略 */
      }
      // 允许进入登录页后再次触发（例如重新登录后又被顶下线）
      setTimeout(() => {
        sessionExpiredHandling = false
      }, 1000)
    },
  })
}

export async function callAdmin<T = any>(
  name: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const key = cacheKey(name, data)
  const isRead = READ_FNS.has(name)
  if (isRead) {
    const hit = cacheStore.get(key)
    if (hit && hit.expires > Date.now()) return hit.data as T
    const running = inflight.get(key)
    if (running) return running
  }

  const req = (async () => {
    // 统一携带 token；cloud.ts 已在非小程序环境自动切换 mock
    try {
      return await callFunction<T>(name, { ...data, token: getAdminToken() })
    } catch (err) {
      if (isAdminAuthError(err)) handleAdminSessionExpired()
      throw err
    }
  })()

  if (isRead) {
    inflight.set(key, req)
    try {
      const res = await req
      cacheStore.set(key, { expires: Date.now() + CACHE_TTL, data: res })
      return res
    } finally {
      inflight.delete(key)
    }
  }
  return req
}

/**
 * 云存储 fileID → 可预览 https 临时链接（仅微信小程序；其它端直接返回空，由 mock 提供 http 图）。
 * 用于云函数返回里 url 为空/已过期/云存储 fileID 的场景兜底。
 */
export async function resolveCloudFileUrls(
  fileList: string[]
): Promise<Record<string, string>> {
  const ids = [...new Set((fileList || []).filter((f) => f && typeof f === 'string'))]
  if (ids.length === 0) return {}
  if (process.env.TARO_ENV !== 'weapp') return {}

  const map: Record<string, string> = {}
  // 分批换取，避免单次参数过大
  const CHUNK = 50
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    try {
      const res = (await (Taro.cloud.getTempFileURL as any)({
        fileList: chunk.map((fileID) => ({ fileID, maxAge: 30 * 60 * 1000 })),
      })) as unknown as {
        fileList?: Array<{ fileID?: string; tempFileURL?: string; status?: number }>
      }
      for (const it of res?.fileList || []) {
        if (it?.fileID && it?.tempFileURL) map[it.fileID] = it.tempFileURL
      }
    } catch (err) {
      console.warn('[Admin] 云存储换链接失败（分批）', err)
      // 降级：逐条重试一次，尽力而为
      for (const fileID of chunk) {
        try {
          const single = (await (Taro.cloud.getTempFileURL as any)({
            fileList: [{ fileID, maxAge: 30 * 60 * 1000 }],
          })) as unknown as { fileList?: Array<{ fileID?: string; tempFileURL?: string }> }
          const it = single?.fileList?.[0]
          if (it?.fileID && it?.tempFileURL) map[it.fileID] = it.tempFileURL
        } catch (err2) {
          console.warn('[Admin] 云存储单条换链接失败', fileID, err2)
        }
      }
    }
  }
  return map
}
