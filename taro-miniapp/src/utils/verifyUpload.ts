import Taro from '@tarojs/taro'

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
  for (const q of qualities) {
    let out = ''
    let size = 0
    try {
      out = await compressQuality(src, q)
      size = await getFileSize(out)
    } catch (err) {
      break // 当前质量不支持（或已无可压缩空间）
    }
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
        resolve({ name, fileID: res.fileID })
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || 'uploadFile fail'))
      },
    })
  })
}

/**
 * 选择一张相册照片并压缩/上传。
 * 仅在微信小程序环境使用真实相册与云存储；其它端返回“跳过”供演示兜底。
 */
export async function pickAndUploadMaterial(name: string): Promise<UploadedMaterial | null> {
  if (process.env.TARO_ENV !== 'weapp') {
    // H5/预览环境无相册能力：标记跳过（页面会提示仅在微信中使用）
    return null
  }
  try {
    const res = await Taro.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      sizeType: ['compressed'],
    })
    const file = res.tempFiles && res.tempFiles[0]
    if (!file || !file.tempFilePath) {
      throw new Error('未选择照片')
    }
    const { path, size } = await compressToRange(file.tempFilePath)
    const material = await cloudUpload(path, name)
    material.size = size
    return material
  } catch (err) {
    console.error('[VerifyUpload] 上传失败', err)
    throw err
  }
}

/** 字节数 → MB 展示 */
export function formatMB(bytes?: number): string {
  if (!bytes) return '0.00 MB'
  return (bytes / MB).toFixed(2) + ' MB'
}
