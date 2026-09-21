const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 归一化材料（兼容数组 / 对象 map / 纯文本历史数据）
function normalizeMaterials(v) {
  const raw = v.materials
  const out = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && item.fileID) {
        out.push({ name: item.name || '材料图片', fileID: String(item.fileID) })
      } else if (typeof item === 'string' && item) {
        if (item.startsWith('cloud://')) out.push({ name: '材料图片', fileID: item })
        else out.push({ name: item, fileID: '', text: item })
      }
    }
  } else if (raw && typeof raw === 'object') {
    for (const key of Object.keys(raw)) {
      const it = raw[key]
      if (it && typeof it === 'object' && it.fileID) {
        out.push({ name: it.name || key, fileID: String(it.fileID) })
      }
    }
  }
  return out
}

/**
 * 读取当前老师最近一次实名学籍认证状态。
 * 认证页据此锁定表单：待审核 / 已通过时不可修改；已驳回后可重新上传。
 */
exports.main = async () => {
  try {
    const openid = cloud.getWXContext().OPENID
    const res = await db
      .collection('verifications')
      .where({ _openid: openid })
      .orderBy('createTime', 'desc')
      .limit(1)
      .get()
    const v = res.data[0] || null
    if (!v) return { code: 0, message: 'success', data: { verification: null } }

    const materials = normalizeMaterials(v)
    const fileIDs = [...new Set(materials.map((m) => m.fileID).filter(Boolean))]
    const urlMap = {}
    if (fileIDs.length) {
      try {
        const r = await cloud.getTempFileURL({ fileList: fileIDs })
        for (const it of r.fileList || []) {
          if (it.fileID && it.tempFileURL) urlMap[it.fileID] = it.tempFileURL
        }
      } catch (e) {
        console.warn('[getMyVerification] getTempFileURL 失败', e)
      }
    }

    return {
      code: 0,
      message: 'success',
      data: {
        verification: {
          id: v._id,
          status: v.status || '待审核',
          name: v.name || '',
          school: v.school || '',
          college: v.college || '',
          major: v.major || '',
          authorized: !!v.authorized,
          rejectReason: v.rejectReason || '',
          teacherNo: v.teacherNo || '',
          archived: !!v.archived,
          cleared: !!v.cleared,
          materials: materials.map((m) => ({ ...m, url: m.fileID ? urlMap[m.fileID] || '' : '' })),
          createTime: v.createTime || null,
          reviewTime: v.reviewTime || null,
        },
      },
    }
  } catch (err) {
    console.error('[getMyVerification] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
