const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const { requireAdmin } = require('./requireAdmin')

// 平台唯一合作院校：实名学籍档案的院校字段不接受客户端篡改
const PARTNER_SCHOOL = '湖南师范大学'

function normText(v, max) {
  return String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

/**
 * 管理员合规修改老师实名学籍档案：
 * 认证通过后的实名信息为不可修改的正式档案，仅允许管理员在特殊场景下修改，且必须填写修改原因留痕。
 */
exports.main = async (event, context) => {
  try {
    const admin = await requireAdmin(event) // 鉴权

    const body = event && event.data && typeof event.data === 'object' ? event.data : event || {}
    const name = normText(body.name, 20)
    const college = normText(body.college, 30)
    const major = normText(body.major, 30)
    const reason = normText(body.reason, 200)

    if (!name) return { code: -1, message: '请填写修改后的真实姓名', data: null }
    if (!college) return { code: -1, message: '请填写修改后的学院名称', data: null }
    if (!major) return { code: -1, message: '请填写修改后的专业名称', data: null }
    if (!reason) return { code: -1, message: '合规修改必须填写修改原因', data: null }

    // 定位目标认证记录：优先 verificationId，其次按 openid 取最近一次已通过认证
    let verify = null
    if (body.verificationId) {
      const r = await db.collection('verifications').doc(String(body.verificationId)).get().catch(() => null)
      verify = (r && r.data) || null
    } else if (body.openid) {
      const r = await db
        .collection('verifications')
        .where({ _openid: String(body.openid), status: '已通过' })
        .orderBy('reviewTime', 'desc')
        .limit(1)
        .get()
        .catch(() => ({ data: [] }))
      verify = r.data[0] || null
    }
    if (!verify) return { code: -1, message: '未找到可修改的实名学籍档案', data: null }
    if (verify.status !== '已通过') return { code: -1, message: '仅已通过的正式档案支持合规修改', data: null }

    const before = {
      name: verify.name || '',
      college: verify.college || '',
      major: verify.major || '',
    }

    await db.collection('verifications').doc(verify._id).update({
      data: {
        name,
        college,
        major,
        school: verify.school || PARTNER_SCHOOL, // 院校固定，不可篡改
        archived: true,
        locked: true,
        lastModifiedBy: admin.username,
        lastModifiedAt: db.serverDate(),
        lastModifyReason: reason,
      },
    })

    const realName = {
      name,
      school: verify.school || PARTNER_SCHOOL,
      college,
      major,
    }

    if (verify._openid) {
      await db
        .collection('teacher_users')
        .where({ _openid: verify._openid })
        .update({
          data: {
            realName,
            realNameLocked: true,
            realNameVerifiedAt: db.serverDate(),
            updateTime: db.serverDate(),
          },
        })
        .catch((e) => console.warn('[adminUpdateRealName] 写回老师账号失败', e))

      if (verify.authorized) {
        await db
          .collection('applications')
          .where({ _openid: verify._openid })
          .update({ data: { name, college, major } })
          .catch((e) => console.warn('[adminUpdateRealName] 更新报名快照失败', e))
      }
    }

    await db.collection('audit_logs').add({
      data: {
        operator: admin.username,
        level: admin.level || 'admin',
        action: 'admin_update_real_name',
        detail: { verificationId: verify._id, openid: verify._openid || '', reason, before, after: { name, college, major } },
        createTime: db.serverDate(),
      },
    })

    return { code: 0, message: 'success', data: { ok: true } }
  } catch (err) {
    console.error('[adminUpdateRealName] error:', err)
    if (err.code === 'FORBIDDEN') return { code: -1, message: '无管理员权限', data: null }
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
