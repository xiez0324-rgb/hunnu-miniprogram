/**
 * 管理员登录的失败锁定判定（纯函数，不依赖 wx-server-sdk，便于离线测试）
 *
 * 背景：原实现没有任何失败次数限制，且对「账号不存在」与「密码错误」返回不同文案，
 *      等于告诉攻击者哪些账号名有效，配合无限次尝试可被字典攻击。
 *
 * 约定：
 *  - 账号不存在 / 已停用 / 密码错误，对外一律返回同一句 GENERIC_AUTH_ERROR，
 *    避免账号枚举；剩余可试次数也不下发给客户端（否则同样能反推账号是否存在）。
 *  - 失败计数落在**该账号自己的文档**上（复用 admins 集合，无需新建集合）。
 *  - 连续失败达 MAX_FAILED_ATTEMPTS 次后锁定 LOCK_MS，锁定期间即使密码正确也拒绝。
 *  - 登录成功时清空计数与锁定。
 *
 * 已知残留（可接受）：
 *  - 账号不存在时无文档可记，故不计数、不锁定；但返回文案与"密码错误"完全一致，
 *    攻击者无法据此区分账号是否存在。
 *  - 锁定文案本身说明"该账号存在"，仅在第 5 次失败后才出现。
 *  - 攻击者可故意打满失败次数把真实管理员锁在门外（15 分钟）；
 *    可在云开发控制台直接清空该账号的 lockedUntil 字段解除。
 */

const MAX_FAILED_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000
const GENERIC_AUTH_ERROR = '账号或密码错误'

/**
 * 判断账号当前是否处于锁定期
 * @param {object} admin 管理员文档
 * @param {number} now 当前时间戳（ms）
 * @returns {{locked: boolean, minutesLeft: number}}
 */
function evaluateLock(admin, now) {
  const until = admin && admin.lockedUntil ? new Date(admin.lockedUntil).getTime() : 0
  if (!until || !(until > now)) return { locked: false, minutesLeft: 0 }
  return { locked: true, minutesLeft: Math.max(1, Math.ceil((until - now) / 60000)) }
}

/**
 * 记录一次失败：返回要写回数据库的字段，以及对外文案
 * @param {object} admin 管理员文档
 * @param {number} now 当前时间戳（ms）
 * @returns {{patch: object, message: string}}
 */
function buildFailurePatch(admin, now) {
  const failed = (Number(admin && admin.failedAttempts) || 0) + 1
  if (failed >= MAX_FAILED_ATTEMPTS) {
    return {
      patch: { failedAttempts: 0, lockedUntil: new Date(now + LOCK_MS) },
      message: `失败次数过多，账号已临时锁定 ${Math.round(LOCK_MS / 60000)} 分钟`,
    }
  }
  return { patch: { failedAttempts: failed }, message: GENERIC_AUTH_ERROR }
}

/** 登录成功时需要写回的字段（清空失败计数与锁定） */
function successResetPatch() {
  return { failedAttempts: 0, lockedUntil: null }
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  LOCK_MS,
  GENERIC_AUTH_ERROR,
  evaluateLock,
  buildFailurePatch,
  successResetPatch,
}
