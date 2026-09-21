// 图片浏览工具集（小程序端统一入口）
// 能力：fileID→临时链接解析（带缓存）、大图带进度下载、保存到相册（含授权被拒引导）、相邻图预加载。
// 说明：系统级 Taro.previewImage 为主通道（原生支持双指缩放/左右滑切/长按保存），
//       本工具为它补齐「链接解析 / 弱网容错 / 降级 / 授权引导」增强外壳。

import Taro from '@tarojs/taro'
import { ensureWechatPrivacy } from '@/services/privacy'
import { resolveCloudFileUrls } from '@/services/admin'

/** 统一图片浏览对象：cloud fileID 或 http(s) 直链均可 */
export interface GalleryImage {
  key?: string
  /** 业务名称（如「学生证」「学信网截图」） */
  name?: string
  /** 云存储 fileID */
  fileID?: string
  /** http(s) 可预览地址（云存储临时链接 / mock 直链） */
  src?: string
  /** 历史纯文本材料说明（无图时展示文本） */
  text?: string
}

/** 会话内 fileID → 临时链接缓存（避免反复换链接） */
const fileUrlCache = new Map<string, string>()

export function isHttpUrl(u?: string): boolean {
  return !!u && /^https?:\/\//i.test(u)
}

export function isCloudFileId(u?: string): boolean {
  return !!u && u.startsWith('cloud://')
}

export function getCachedFileUrl(fileID?: string): string {
  return fileID ? fileUrlCache.get(fileID) || '' : ''
}

/**
 * 单图强制刷新：无视缓存现场向云存储换取新临时链接（用于链接过期/加载失败的“刷新链接”重试）。
 */
export async function refreshGalleryItem(it: GalleryImage): Promise<GalleryImage> {
  const cid = it.fileID || (isCloudFileId(it.src) ? it.src : '')
  if (!cid || process.env.TARO_ENV !== 'weapp') return it
  const map = await resolveCloudFileUrls([cid])
  const url = map[cid]
  if (url) {
    fileUrlCache.set(cid, url)
    return { ...it, src: url }
  }
  return it
}

/**
 * 批量把「有 fileID / cloud:// 前缀但无 http 地址」的图片解析为可预览地址。
 * 非小程序环境（mock 直链）原样返回。
 */
export async function resolveGalleryImages(items: GalleryImage[]): Promise<GalleryImage[]> {
  if (!items || !items.length) return items
  const next = items.map((it) => ({ ...it }))
  const needFileIds: string[] = []
  const needIdx: number[] = []

  next.forEach((it, i) => {
    const cid = it.fileID || (isCloudFileId(it.src) ? it.src : '')
    if (!cid) return
    if (isHttpUrl(it.src)) return
    const cached = fileUrlCache.get(cid)
    if (cached) {
      next[i] = { ...it, src: cached }
      return
    }
    needFileIds.push(cid)
    needIdx.push(i)
  })

  if (!needFileIds.length) return next
  const map = await resolveCloudFileUrls(needFileIds)
  needFileIds.forEach((cid, j) => {
    const url = map[cid]
    if (!url) return
    fileUrlCache.set(cid, url)
    const idx = needIdx[j]
    next[idx] = { ...next[idx], src: url }
  })
  return next
}

/** 判断 src 是否为本地文件路径（可直接保存，无需再下载） */
export function isLocalFilePath(src: string): boolean {
  return /^(wxfile|http:\/\/tmp|http:\/\/usr|file:\/\/|\.\.\/|\.\/)/.test(src) || src.indexOf('/') === 0
}

/**
 * 展示用地址（小程序内零域名依赖）：
 *  - 微信端：有云存储 fileID 时优先用 cloud:// 直显（不换临时链接，不触发 downloadFile 域名校验）；
 *  - H5 / 其它端：用 http 直链（mock）。
 */
export function displaySrc(item: GalleryImage | undefined | null): string {
  if (!item) return ''
  const isWeapp = process.env.TARO_ENV === 'weapp'
  if (isWeapp && (item.fileID || isCloudFileId(item.src))) {
    return (item.fileID || item.src) as string
  }
  return item.src || ''
}

/**
 * 下载大图到本地（返回临时路径），带下载进度回调；仅微信小程序支持。
 * 零域名设计：
 *  - 有云存储 fileID → 走 wx.cloud.downloadFile（云开发私有链路，无需 downloadFile 合法域名）；
 *  - 仅 http(s) 且非云存储 → 走 wx.downloadFile（生产流程不应出现，如出现需自行配置 downloadFile 域名）。
 */
export function downloadGalleryImage(
  target: { fileID?: string; src?: string },
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.env.TARO_ENV !== 'weapp') {
      reject(new Error('仅微信小程序支持本地下载'))
      return
    }
    const fileID = target.fileID && isCloudFileId(target.fileID) ? target.fileID : ''
    const src = target.src || ''

    if (fileID) {
      const task = Taro.cloud.downloadFile({
        fileID,
        success(res) {
          resolve(res.tempFilePath)
        },
        fail(err) {
          const msg = (err && err.errMsg) || ''
          reject(new Error(/timeout|网络|fail|超时/i.test(msg) ? '网络不佳，图片下载超时' : msg || '图片下载失败'))
        },
      })
      if (onProgress && task && typeof task.onProgressUpdate === 'function') {
        task.onProgressUpdate((res: { progress?: number }) => {
          if (res && typeof res.progress === 'number') onProgress(res.progress)
        })
      }
      return
    }

    if (!src) {
      reject(new Error('无可用图片地址'))
      return
    }
    if (isLocalFilePath(src)) {
      resolve(src)
      return
    }
    const task = Taro.downloadFile({
      url: src,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.tempFilePath)
        } else {
          reject(new Error(`图片下载失败（HTTP ${res.statusCode}）`))
        }
      },
      fail(err) {
        const msg = (err && err.errMsg) || ''
        reject(new Error(/timeout|网络|fail/i.test(msg) ? '网络不佳，图片加载超时' : msg || '图片下载失败'))
      },
    })
    if (onProgress && task && typeof task.onProgressUpdate === 'function') {
      task.onProgressUpdate((res: { progress?: number }) => {
        if (res && typeof res.progress === 'number') onProgress(res.progress)
      })
    }
  })
}

/**
 * 保存单张图片到本地相册（入参为展示对象，零域名设计见 downloadGalleryImage）。
 * 处理链路：云下载/下载 → saveImageToPhotosAlbum → 被拒后 showModal 引导 openSetting → 用户开启后自动重试一次。
 * 同时兼容微信隐私接口授权（写入相册属隐私接口）。
 */
export function saveGalleryImage(item: GalleryImage): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.env.TARO_ENV !== 'weapp') {
      Taro.showToast({ title: '请在微信小程序中使用', icon: 'none' })
      reject(new Error('非微信环境不支持保存相册'))
      return
    }
    ensureWechatPrivacy()

    let retried = false
    const trySave = (path: string) => {
      Taro.saveImageToPhotosAlbum({
        filePath: path,
        success() {
          Taro.showToast({ title: '已保存到相册', icon: 'success' })
          resolve()
        },
        fail(err) {
          const msg = (err && err.errMsg) || ''
          if (/auth|deny|permission|authorize/i.test(msg)) {
            guideOpenSetting(resolve, reject, retried)
            retried = true
          } else {
            console.error('[SaveImage] 保存失败', err)
            Taro.showToast({ title: msg.includes('cancel') ? '已取消' : '保存失败，请重试', icon: 'none' })
            reject(err)
          }
        },
      })
    }

    const guideOpenSetting = (_ok: () => void, no: (e: Error) => void, already: boolean) => {
      Taro.showModal({
        title: '需要相册权限',
        content: '保存图片需要您授权「添加到相册」权限，请在设置中开启后重试。',
        confirmText: '去设置',
        cancelText: '暂不',
        success(res) {
          if (!res.confirm) {
            no(new Error('未授权相册'))
            return
          }
          Taro.openSetting({
            success(s) {
              const val = (s.authSetting || {})['scope.writePhotosAlbum']
              if (val) {
                if (already) {
                  Taro.showToast({ title: '请再次点击保存', icon: 'none' })
                  no(new Error('授权完成，请重试保存'))
                } else {
                  // 授权成功直接重试一次
                  ensureWechatPrivacy()
                  trySave(displaySrc(item))
                }
              } else {
                Taro.showToast({ title: '未开启相册权限', icon: 'none' })
                no(new Error('未开启相册权限'))
              }
            },
            fail() {
              no(new Error('打开设置失败'))
            },
          })
        },
        fail() {
          no(new Error('未授权相册'))
        },
      })
    }

    // 已在本地（前一步下载过 / 本地路径）直接保存
    const local = item.src && isLocalFilePath(item.src) ? item.src : ''
    if (local) {
      trySave(local)
      return
    }
    downloadGalleryImage({ fileID: item.fileID, src: item.src })
      .then(trySave)
      .catch((err) => {
        Taro.showToast({ title: (err as Error).message || '下载失败', icon: 'none' })
        reject(err)
      })
  })
}

/**
 * 预加载相邻图片（静默预热）。
 * 零域名设计：微信端相邻项有 fileID 时用 wx.cloud.downloadFile 预热（云链路无需域名）；
 * 纯 http(s) 图在微信端不做 getImageInfo 预热（那会触发 downloadFile 域名校验），仅 H5 直接忽略。
 */
export function preloadNeighbors(items: GalleryImage[], current: number): void {
  if (process.env.TARO_ENV !== 'weapp') return
  const candidates = [current - 1, current + 1].filter((i) => i >= 0 && i < items.length)
  for (const i of candidates) {
    const it = items[i]
    const fileID = it?.fileID && isCloudFileId(it.fileID) ? it.fileID : ''
    if (!fileID) continue
    try {
      // 预热失败忽略（展示时会走错误兜底）
      Taro.cloud.downloadFile({ fileID }).catch(() => {})
    } catch (err) {
      /* 忽略 */
    }
  }
}

