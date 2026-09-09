import cloudbase from "@cloudbase/js-sdk";
import { ENV_ID } from "./env";

// 初始化 CloudBase 应用（Web 端：不直连数据库，一律经云函数）
const app = cloudbase.init({ env: ENV_ID });

const TOKEN_KEY = "admin_token";
const USER_KEY = "admin_user";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function getUser(): { username?: string; level?: string } {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "{}");
  } catch {
    return {};
  }
}
export function setSession(token: string, username: string, level: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify({ username, level }));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ---- CloudBase 身份认证（用户名密码登录）----
const auth = app.auth();

// 当前是否已有 CloudBase 登录态（SDK 本地持久化约 30 天）
export function hasCloudSession(): boolean {
  try {
    return Boolean(auth.currentUser);
  } catch {
    return false;
  }
}

// 退出 CloudBase 登录态
export async function cloudSignOut() {
  try {
    await auth.signOut();
  } catch {
    /* 忽略 SDK 层退出异常，本地 token 已一并清除 */
  }
}

// 登录总流程：
// 1) 先用「用户名密码」登录 CloudBase 身份认证（Web 端调用云函数需具备登录态）
// 2) 再调 adminLogin 校验业务账号（admins 集合），换取管理会话 token
export async function signInAdmin(username: string, password: string) {
  if (!hasCloudSession()) {
    const { data, error } = await auth.signInWithPassword({ username, password });
    if (error) {
      throw new Error(`身份认证失败：${error.message || "账号或密码错误"}`);
    }
    if (!data?.session) {
      throw new Error("身份认证失败：未获取到登录会话，请重试");
    }
  }
  // 业务账号校验（admins 集合）→ 返回 { token, username, level }
  const res = await callAdmin<{ token: string; username: string; level: string }>("adminLogin", {
    username,
    password,
  });
  return res;
}

// ---- 读接口短缓存（避免切 tab 反复全量拉取）----
// 只对只读列表类接口缓存；写操作（改状态/审核/登记费用等）走网络，成功后调 invalidateAdminCache 失效
const READ_FNS = new Set([
  "adminDashboard",
  "adminListOrders",
  "adminListVerifications",
  "adminListDeliveries",
  "adminListFeeRecords",
]);
const CACHE_TTL = 60_000; // 60 秒：切页秒回；管理员做变更时由各操作显式失效缓存
const cacheStore = new Map<string, { expires: number; data: unknown }>();
const inflight = new Map<string, Promise<any>>();

function cacheKey(name: string, data: Record<string, unknown>) {
  return `${name}|${JSON.stringify(data)}`;
}

// 失效某个接口（按函数名前缀）或全部缓存
export function invalidateAdminCache(name?: string) {
  if (!name) {
    cacheStore.clear();
    return;
  }
  const prefix = `${name}|`;
  for (const k of cacheStore.keys()) {
    if (k.startsWith(prefix)) cacheStore.delete(k);
  }
}

// 统一调用：管理云函数一律携带 token，由云端 requireAdmin 鉴权
export async function callAdmin<T = any>(
  name: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const key = cacheKey(name, data);
  const isRead = READ_FNS.has(name);

  // 读接口：短缓存命中直接返回；并发重复请求去重
  if (isRead) {
    const hit = cacheStore.get(key);
    if (hit && hit.expires > Date.now()) return hit.data as T;
    const running = inflight.get(key);
    if (running) return running;
  }

  const req = (async () => {
    let res;
    try {
      res = await app.callFunction({
        name,
        data: { ...data, token: getToken() },
      });
    } catch (err) {
      const msg = (err as Error)?.message || String(err);
      // 未登录/会话失效时提示重新登录
      if (/登录|not\s*login|login\s*required|UNAUTHENTICATED/i.test(msg)) {
        clearSession();
        throw new Error("登录已失效，请重新登录");
      }
      // 云函数不存在 / 未部署 / 被旧版本覆盖
      if (/not\s*found|not\s*exist|不存在|未找到|FunctionName|function\s*not|not\s*deployed/i.test(msg)) {
        throw new Error(
          `云函数「${name}」不存在或未部署：请在云开发控制台对该函数执行「上传并部署：云端安装依赖」后再刷新（底层错误：${msg.slice(0, 160)}）`
        );
      }
      // 权限不足类（登录成功但非管理员/安全规则拒绝）
      if (/forbidden|denied|no\s*permission|无权|invalid\s*token|签名|signature/i.test(msg)) {
        throw new Error(`访问被拒绝：请确认当前账号为管理员且已重新登录（${msg.slice(0, 160)}）`);
      }
      // 域名白名单 / 网络 / 登录态缺失等通用云环境问题
      throw new Error(
        msg.includes("cloudbase")
          ? `云函数调用失败，请检查安全域名配置与登录态（${name}）`
          : `云函数「${name}」调用失败：${msg.slice(0, 160)}`
      );
    }
    const result = res.result as { code: number; message: string; data: T };
    if (result.code !== 0) {
      throw new Error(result.message || "请求失败");
    }
    return result.data;
  })();

  if (isRead) {
    inflight.set(key, req);
    try {
      const dataRes = await req;
      cacheStore.set(key, { expires: Date.now() + CACHE_TTL, data: dataRes });
      return dataRes;
    } finally {
      inflight.delete(key);
    }
  }
  return req;
}
