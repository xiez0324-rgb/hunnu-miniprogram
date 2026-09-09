const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')

// 归一化材料记录。兼容多种历史/现网形态：
// - 新版数组 [{ name, fileID }]（学籍认证上传的真实云存储图）
// - 旧版纯字符串（cloud:// 开头的 fileID，或纯文本说明如「学生证照片.jpg」）
// - 材料以对象 map 存储（{ card: {...}, xueli: {...} }）
// - 更早版本散落字段（cardFileID / xueliFileID / studentCard / chsiScreenshot 等，取其中 fileID/文本）
function collectMaterialCandidates(v) {
  const out = []
  const raw = v.materials
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object') out.push(item)
      else if (typeof item === 'string') out.push({ text: item })
    }
  } else if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      const it = raw[key]
      if (it && typeof it === 'object') out.push(Object.assign({ slot: key }, it))
      else if (typeof it === 'string') out.push({ slot: key, text: it })
    }
  }
  // 早期散落字段兜底（字段名按历史版本约定收集，命中与否不影响新数据）
  for (const f of ['cardFileID', 'xueliFileID', 'studentCard', 'chsiScreenshot']) {
    const val = v[f]
    if (val === undefined || val === null || val === '') continue
    if (typeof val === 'string') out.push({ legacyField: f, text: val })
  }
  return out
}

function normalizeMaterials(v) {
  const norm = []
  const seen = new Set()
  for (const item of collectMaterialCandidates(v)) {
    const fileID = String(item.fileID || item.id || item.file || '').trim()
    if (fileID) {
      // 同一张图只保留一次（避免对象 map + 数组双份重复）
      if (seen.has(fileID)) continue
      seen.add(fileID)
      norm.push({ name: String(item.name || item.slot || '材料图片').trim() || '材料图片', fileID })
    } else {
      const text = String(item.text || '').trim()
      if (text && text.startsWith('cloud://')) {
        if (seen.has(text)) continue
        seen.add(text)
        norm.push({ name: String(item.name || item.slot || '材料图片').trim() || '材料图片', fileID: text })
      } else if (text) {
        norm.push({ name: text, fileID: '', raw: text })
      }
    }
  }
  // 无 materials 字段的极旧记录：无内容可展示
  return norm
}

// 分块换取临时 URL：文件多时分批调用，避免一次参数过长/触发超限
async function batchGetTempFileURL(fileIDs, chunkSize = 50) {
  const urlMap = {}
  for (let i = 0; i < fileIDs.length; i += chunkSize) {
    const chunk = fileIDs.slice(i, i + chunkSize)
    try {
      const r = await cloud.getTempFileURL({ fileList: chunk })
      for (const item of r.fileList || []) {
        // 只要返回了可预览地址即采用（部分网关/运行时对 status 字段类型不一致，不再强依赖 status===0）
        if (item.fileID && item.tempFileURL) {
          urlMap[item.fileID] = item.tempFileURL
        }
      }
    } catch (e) {
      console.warn('[adminListVerifications] getTempFileURL chunk fail', e)
    }
  }
  return urlMap
}

exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权
    // 兼容两种调用形态：直传业务参数 / 工具按 { name, data } 包装传参
    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const status = body.status || '待审核'
    const cond = status && status !== '全部' ? { status } : {}

    const res = await db.collection('verifications').where(cond).orderBy('createTime', 'desc').limit(100).get()

    // 收集全部 fileID，统一换取临时可预览 URL（管理端 web 无法直读 cloud:// 路径）
    const all = res.data.map((v) => normalizeMaterials(v))
    const fileIDs = [...new Set(all.flat().map((m) => m.fileID).filter(Boolean))]
    const urlMap = await batchGetTempFileURL(fileIDs)

    const list = res.data.map((v, i) => ({
      id: v._id,
      openid: v._openid || '',
      name: v.name || '',
      school: v.school || '',
      college: v.college || '',
      major: v.major || '',
      authorized: !!v.authorized,
      materials: all[i].map((m) => ({
        name: m.name || '材料图片',
        fileID: m.fileID || '',
        url: m.fileID ? urlMap[m.fileID] || '' : '',
        text: m.raw || '',
      })),
      status: v.status,
      rejectReason: v.rejectReason || '',
      createTime: v.createTime || null,
    }))

    return { code: 0, message: 'success', data: { list } }
  } catch (err) {
    console.error('[adminListVerifications] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
