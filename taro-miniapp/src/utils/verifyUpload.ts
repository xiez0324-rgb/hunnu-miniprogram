import Taro from '@tarojs/taro'
import { ensureWechatPrivacyAsync } from '@/services/privacy'

/**
 * 学籍认证照片上传模块（仅微信小程序生效）
 *
 * 流程：相册选图 → 压缩至 1MB~2MB → 云存储上传拿 fileID → 返回
 * 说明：wx.compressImage 只能按「质量」压缩（不改变分辨率），
 * 无法让平台回传精确字节数，因此用质量阶梯试探，选出落在 1MB~2MB 的一档。
 * 若原图不足 1MB（如截图本身较小），保持原样上传（不放大降低画质）。
 */

const MB = 1024 * 1024
const MIN_BYTES = 1 * MB
const MAX_BYTES = 2 * MB

export interface UploadedMaterial {
  name: string // 材料名称，如 学生证 / 学信网截图
  fileID: string // 云存储 fileID
  size?: number
}

function getFileSize(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const fs = Taro.getFileSystemManager()
      fs.getFileInfo({
        filePath,
        success(res) {
          resolve((res && (res.size as number)) || 0)
        },
        fail(err) {
          reject(new Error((err && err.errMsg) || 'getFileInfo fail'))
        },
      })
    } catch (err) {
      reject(err as Error)
    }
  })
}

function compressQuality(src: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    Taro.compressImage({
      src,
      quality,
      success(res) {
        resolve(res.tempFilePath)
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || 'compressImage fail'))
      },
    })
  })
}

// 尝试把图片压缩到 1MB~2MB：优先返回命中区间且体积最大的一档；
// 全部不满足时返回 ≤2MB 中体积最大的一档（可能是 <1MB 的小截图或原图）
async function compressToRange(src: string): Promise<{ path: string; size: number }> {
  let originSize = 0
  try {
    originSize = await getFileSize(src)
  } catch (err) {
    originSize = 0
  }
  if (originSize > 0 && originSize >= MIN_BYTES && originSize <= MAX_BYTES) {
    return { path: src, size: originSize }
  }
  // 原图小于 1MB（截图类）：直接上传原图，保证清晰度，无法也不需要强行放大
  if (originSize > 0 && originSize < MIN_BYTES) {
    return { path: src, size: originSize }
  }

  // 从高质量往低质量试探，记录命中区间/兜底的最佳档位
  const qualities = [96, 90, 82, 74, 66, 58, 50, 42, 34, 28, 22, 16, 12]
  let best = ''
  let bestSize = 0
  let bestInRange = ''
  let bestInRangeSize = 0
  let fails = 0
  for (const q of qualities) {
    let out = ''
    let size = 0
    try {
      out = await compressQuality(src, q)
      size = await getFileSize(out)
    } catch (err) {
      // 偶发单档失败继续尝试；连续 3 档都失败则判定设备不支持压缩，直接用原图上传
      fails++
      if (fails >= 3) break
      continue
    }
    fails = 0
    if (!size) continue
    if (size <= MAX_BYTES && size > bestSize) {
      best = out
      bestSize = size
    }
    if (size >= MIN_BYTES && size <= MAX_BYTES && size > bestInRangeSize) {
      bestInRange = out
      bestInRangeSize = size
    }
    if (size < MIN_BYTES) break // 继续降质量只会更小
  }
  if (bestInRange) return { path: bestInRange, size: bestInRangeSize }
  if (best) return { path: best, size: bestSize }
  return { path: src, size: originSize }
}

function cloudUpload(tempPath: string, name: string): Promise<UploadedMaterial> {
  return new Promise((resolve, reject) => {
    const ext = (tempPath.match(/\.(\w+)$/) || [])[1] || 'jpg'
    const cloudPath = `verifications/${Date.now()}_${Math.round(Math.random() * 1e6)}.${ext === 'heic' ? 'jpg' : ext}`
    Taro.cloud.uploadFile({
      cloudPath,
      filePath: tempPath,
      success(res) {
        if (!res || !res.fileID) {
          reject(new Error('云存储未返回文件 ID，请检查云开发环境是否正常'))
          return
        }
        resolve({ name, fileID: res.fileID })
      },
      fail(err) {
        const msg = (err && err.errMsg) || 'uploadFile fail'
        console.warn('[verifyUpload] cloud.uploadFile 失败，原始错误：', msg)
        reject(new Error(friendlyErrMsg(msg, '上传到云存储失败，请检查网络后重试')))
      },
    })
  })
}

/** 把微信原始 errMsg 转成用户能看懂、且便于定位的提示 */
function friendlyErrMsg(raw: string, fallback: string): string {
  const msg = String(raw || '')
  if (/cancel/i.test(msg)) return 'cancel'
  // 「未在隐私协议中声明」必须优先判定：其原文形如
  // "api scope is not declared in the privacy agreement"，含 scope，
  // 若放在通用隐私分支之后会被吞掉，导致提示指向错误原因。
  if (/declared in the privacy|is not declared/i.test(msg)) {
    return '后台尚未声明相册权限：请在微信公众平台补充《用户隐私保护指引》中的相册/摄像头用途'
  }
  if (/privacy|scope|auth\s*deny|not authorized/i.test(msg)) {
    return '未完成隐私授权：请先同意《用户隐私保护指引》后再上传照片'
  }
  if (/network|timeout|fail\s*timeout/i.test(msg)) return '网络异常，请检查网络后重试'
  return `${fallback}（${msg}）`
}

/** 微信侧「隐私授权未完成」类错误：官方弹窗被跳过 / 用户曾拒绝 / 后台指引未生效 */
function isPrivacyError(raw: string): boolean {
  return /privacy|scope|declared|not authorized|auth\s*deny/i.test(String(raw || ''))
}

/**
 * 隐私类失败后的补救：主动再拉起一次微信官方隐私授权，成功则重试一次选图。
 * 真机常见场景：官方隐私弹窗被划掉或曾点过「拒绝」，此后接口一直被拦。
 */
async function retryAfterPrivacy(raw: string): Promise<string> {
  console.warn('[verifyUpload] 疑似隐私授权未完成，尝试重新拉起官方授权。原始错误：', raw)
  const authorized = await ensureWechatPrivacyAsync()
  console.warn('[verifyUpload] 重新拉起授权结果（true=已同意可继续）：', authorized)
  if (!authorized) throw new Error('privacy not authorized')
  return chooseOneImage(false) // 只重试一次，避免死循环
}

/** 打开相册/相机选一张图：优先新接口 chooseMedia，不支持时回退 chooseImage */
function chooseOneImage(allowRetry = true): Promise<string> {
  const useChooseImage = () =>
    new Promise<string>((resolve, reject) => {
      Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album'],
        success(res) {
          const p = (res.tempFilePaths || [])[0]
          if (p) resolve(p)
          else reject(new Error('未选择照片'))
        },
        fail(err) {
          const raw = (err && err.errMsg) || ''
          console.warn('[verifyUpload] chooseImage 失败，原始错误：', raw)
          if (allowRetry && !/cancel/i.test(raw) && isPrivacyError(raw)) {
            retryAfterPrivacy(raw)
              .then(resolve)
              .catch(() => reject(new Error(friendlyErrMsg(raw, '打开相册失败'))))
            return
          }
          reject(new Error(friendlyErrMsg(raw, '打开相册失败')))
        },
      })
    })

  // 若客户端不支持 chooseMedia，直接走 chooseImage
  if (typeof (Taro as unknown as { chooseMedia?: unknown }).chooseMedia !== 'function') {
    return useChooseImage()
  }

  return new Promise<string>((resolve, reject) => {
    Taro.chooseMedia({
      count: 1,
      mediaType: ['image'],
      // 仅相册：避免未在《用户隐私保护指引》声明「摄像头」时接口被拦截
      sourceType: ['album'],
      success(res) {
        const f = res.tempFiles && res.tempFiles[0]
        if (f && f.tempFilePath) resolve(f.tempFilePath)
        else reject(new Error('未选择照片'))
      },
      fail(err) {
        const raw = (err && err.errMsg) || ''
        console.warn('[verifyUpload] chooseMedia 失败，原始错误：', raw)
        // 用户主动取消：不再回退，直接提示取消
        if (/cancel/i.test(raw)) {
          reject(new Error('cancel'))
          return
        }
        // 隐私/授权类失败：先尝试重新拉起官方授权并重试一次，仍失败再给出明确提示
        if (isPrivacyError(raw)) {
          if (!allowRetry) {
            reject(new Error(friendlyErrMsg(raw, '打开相册失败')))
            return
          }
          retryAfterPrivacy(raw)
            .then(resolve)
            .catch(() => reject(new Error(friendlyErrMsg(raw, '打开相册失败'))))
          return
        }
        // 其它失败（如低版本基础库不支持 chooseMedia）→ 回退旧接口
        useChooseImage().then(resolve).catch(reject)
      },
    })
  })
}

/**
 * 选择一张相册/相机照片并压缩、上传云存储。
 * 仅在微信小程序环境使用真实相册与云存储；其它端返回“跳过”供演示兜底。
 * 注意：调用前应由页面先 await ensureWechatPrivacyAsync()，确保隐私授权已完成。
 */
export async function pickAndUploadMaterial(name: string): Promise<UploadedMaterial | null> {
  if (process.env.TARO_ENV !== 'weapp') {
    // H5/预览环境无相册能力：标记跳过（页面会提示仅在微信中使用）
    return null
  }
  const tempFilePath = await chooseOneImage()
  const { path, size } = await compressToRange(tempFilePath)
  const material = await cloudUpload(path, name)
  material.size = size
  return material
}

/** 字节数 → MB 展示 */
export function formatMB(bytes?: number): string {
  if (!bytes) return '0.00 MB'
  return (bytes / MB).toFixed(2) + ' MB'
}
