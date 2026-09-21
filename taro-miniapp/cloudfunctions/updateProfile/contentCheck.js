const cloud = require('wx-server-sdk')

/**
 * 微信内容安全检测（文本）—— security.msgSecCheck v2
 *
 * 目的：为用户提交的自由文本提供违规内容过滤措施
 * （对应《微信小程序平台常见拒绝情形》3.2.11「服务提供者必须提供过滤不当内容的措施」）。
 *
 * 约定：
 *  - 使用 v2：需传 openid + scene + version=2，检测能力明显优于 v1；用户需在近两小时内访问过小程序（业务内必然满足）。
 *  - scene 场景值：1 资料 / 2 评论 / 3 论坛 / 4 社交日志，按提交场景选择以提升命中准确度。
 *  - 返回结果 suggest：pass 通过 / review 需复核 / risky 违规；后两者一律拦截，转平台人工复核。
 *  - 检测服务自身异常（网络/配额）时按「放行」处理，避免审核服务抖动阻断正常业务；
 *    平台侧所有内容仍需管理员人工核验后才对外发布，人工核验为最终兜底。
 *
 * 返回：命中违规时返回提示文案（字符串）；通过或服务异常时返回 null。
 */

const SCENE = {
  资料: 1,
  评论: 2,
  论坛: 3,
  社交日志: 4,
}

const RISKY_MSG = '提交的内容含不符合平台规范的信息，请修改后再提交'

// msgSecCheck v2 单次文本上限 2500 字
const MAX_LEN = 2500

async function checkTexts(list, openid, scene = SCENE.资料) {
  const items = (Array.isArray(list) ? list : [list])
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .map((t) => (t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t))

  // 无内容或缺少 openid（v2 必填）时不做检测，交由人工核验
  if (!items.length || !openid) return null

  for (const content of items) {
    try {
      const res = await cloud.openapi.security.msgSecCheck({
        openid,
        scene,
        version: 2,
        content,
      })
      const suggest = res && res.result && res.result.suggest
      if (suggest && suggest !== 'pass') {
        console.warn('[contentCheck] 命中风险内容', { scene, suggest, label: res.result.label })
        return RISKY_MSG
      }
    } catch (e) {
      // 87014：内容含有违法违规内容（部分通道仍以错误码形式返回）
      if (e && (e.errCode === 87014 || e.errcode === 87014)) {
        console.warn('[contentCheck] 命中风险内容（87014）', { scene })
        return RISKY_MSG
      }
      // 其它异常（未配置权限 / 配额 / 网络）不阻断业务，记录后放行
      console.warn('[contentCheck] msgSecCheck 调用异常，按放行处理：', (e && (e.errMsg || e.message)) || e)
    }
  }
  return null
}

module.exports = { checkTexts, SCENE, RISKY_MSG }
