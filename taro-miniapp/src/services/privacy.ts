import Taro from '@tarojs/taro'

/**
 * 微信官方隐私授权接入（基础库 ≥ 2.32.3）
 *
 * 背景：2023-09-15 起微信要求小程序在使用「隐私接口」前，
 * 必须先征得用户同意（后台需先配置《用户隐私保护指引》）。
 *
 * 本模块不注册 wx.onNeedPrivacyAuthorization（避免把弹窗交给自定义 UI 处理），
 * 让微信在启动阶段直接拉起来自官方的「隐私保护指引」弹窗：
 *   启动 → wx.getPrivacySetting → needAuthorization=true
 *          → wx.requirePrivacyAuthorize() 拉起官方弹窗
 *   用户同意后微信本地记录授权，之后无需重复弹出。
 * 弹窗中的《用户隐私保护指引》契约名/超链接由微信官方读取后台配置自动展示，
 * 页面内无需自行渲染授权 UI。
 */

interface PrivacySetting {
  needAuthorization: boolean
  privacyContractName?: string
}

type RequireAuthorizeOpts = {
  success?: () => void
  fail?: (err: { errMsg?: string }) => void
}

// Taro 类型可能未收录这两个新接口，用类型收窄做能力探测，避免强依赖高版本
const Wx = Taro as unknown as {
  getPrivacySetting?: (opts: { success?: (res: PrivacySetting) => void; fail?: (err: unknown) => void }) => void
  requirePrivacyAuthorize?: (opts: RequireAuthorizeOpts) => void
}

let initialized = false

/**
 * 在 App 启动时调用一次：
 * 仅微信小程序生效；H5/其它端直接跳过。
 */
export function ensureWechatPrivacy(): void {
  if (process.env.TARO_ENV !== 'weapp') return
  if (initialized) return
  initialized = true

  try {
    const getSetting = Wx.getPrivacySetting
    const requireAuthorize = Wx.requirePrivacyAuthorize
    // 基础库过低或调试基础库不支持时静默跳过（不阻塞业务）
    if (!getSetting || !requireAuthorize) return

    getSetting({
      success(res) {
        // 仍未同意 → 主动拉起微信官方隐私弹窗（首次打开触发）
        if (res && res.needAuthorization) {
          requireAuthorize({
            success() {
              /* 用户已同意，正常继续 */
            },
            fail(err) {
              // 用户暂不同意 / 后台尚未配置指引（errMsg 通常为
              // "privacy permission is not authorized" 或 "需要开发者在小程序后台配置《用户隐私保护指引》"）
              console.warn('[Privacy] 未完成隐私授权：', err?.errMsg || err)
            },
          })
        }
      },
      fail() {
        // 无法查询（低版本/未开启），忽略
      },
    })
  } catch (err) {
    console.warn('[Privacy] 隐私授权检查异常：', err)
  }
}

/**
 * 可等待版隐私授权：调用隐私接口（相册/摄像头等）前先 await，
 * 确保「用户已同意」后再继续，避免真机上因授权未完成导致接口直接失败。
 * 返回 true 表示可以继续；false 表示用户拒绝或后台未配置指引。
 */
export function ensureWechatPrivacyAsync(): Promise<boolean> {
  if (process.env.TARO_ENV !== 'weapp') return Promise.resolve(true)
  return new Promise((resolve) => {
    try {
      const getSetting = Wx.getPrivacySetting
      const requireAuthorize = Wx.requirePrivacyAuthorize
      if (!getSetting || !requireAuthorize) {
        console.warn('[Privacy] 当前环境不支持 getPrivacySetting/requirePrivacyAuthorize（需基础库 ≥2.32.3），已跳过官方授权检查')
        resolve(true)
        return
      }
      getSetting({
        success(res) {
          console.warn('[Privacy] getPrivacySetting 返回：', res)
          if (res && res.needAuthorization) {
            requireAuthorize({
              success() {
                console.warn('[Privacy] 用户已同意隐私授权')
                resolve(true)
              },
              fail(err) {
                // 常见原因：用户点了「拒绝」，或后台《用户隐私保护指引》尚未审核通过/生效
                console.warn('[Privacy] 隐私授权未完成，原始错误：', err?.errMsg || err)
                resolve(false)
              },
            })
          } else {
            resolve(true)
          }
        },
        fail(err) {
          console.warn('[Privacy] getPrivacySetting 调用失败，按放行处理：', err)
          resolve(true)
        },
      })
    } catch (err) {
      console.warn('[Privacy] 隐私授权等待异常：', err)
      resolve(true)
    }
  })
}
