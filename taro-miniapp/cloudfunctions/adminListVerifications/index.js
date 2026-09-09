const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')

// 归一化材料记录（兼容新格式对象 {name,fileID} 与旧格式纯字符串/纯文本）
function normalizeMaterials(materials) {
  const arr = Array.isArray(materials) ? materials : []
  const norm = []
  for (const item of arr) {
    if (item && typeof item === 'object' && item.fileID) {
      norm.push({ name: item.name || '材料图片', fileID: item.fileID, raw: null })
    } else if (typeof item === 'string') {
      if (item.startsWith('cloud://')) {
        norm.push({ name: '材料图片', fileID: item, raw: null })
      } else {
        norm.push({ name: item, fileID: '', raw: item })
      }
    }
  }
  return norm
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
    const all = res.data.map((v) => normalizeMaterials(v.materials || []))
    const fileIDs = [...new Set(all.flat().map((m) => m.fileID).filter(Boolean))]
    const urlMap = {}
    try {
      if (fileIDs.length > 0) {
        const r = await cloud.getTempFileURL({ fileList: fileIDs })
        for (const item of r.fileList || []) {
          if (item.fileID && item.tempFileURL) urlMap[item.fileID] = item.tempFileURL
        }
      }
    } catch (e) {
      console.warn('[adminListVerifications] getTempFileURL 失败', e)
    }

    const list = res.data.map((v, i) => ({
      id: v._id,
      openid: v._openid || '',
      name: v.name || '',
      school: v.school || '',
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
