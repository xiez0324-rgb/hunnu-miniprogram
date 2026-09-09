import { useState } from "react";
import { setSession, signInAdmin } from "./api";

interface Props {
  onSuccess: () => void;
}

export default function LoginCard({ onSuccess }: Props) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    if (!username.trim() || !password) {
      setError("请输入账号与密码");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // 先登录 CloudBase 身份认证，再校验业务账号（admins 集合）
      const res = await signInAdmin(username.trim(), password);
      setSession(res.token, res.username, res.level);
      onSuccess();
    } catch (err) {
      setError((err as Error).message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f3ea] p-6">
      <div className="w-full max-w-sm rounded-xl border-2 border-[oklch(0.85_0.03_150)] bg-white p-6 shadow-[0_8px_0_rgba(0,0,0,0.08)]">
        <h1 className="text-xl font-extrabold text-emerald-900">小小陪伴帮 · 管理后台</h1>
        <p className="mt-1 text-sm text-stone-500">仅管理员账号可登录</p>

        <label className="mt-5 block text-sm font-semibold text-stone-700">账号</label>
        <input
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="admin"
        />
        <label className="mt-3 block text-sm font-semibold text-stone-700">密码</label>
        <input
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="请输入密码"
        />

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <button
          className="mt-5 w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          onClick={login}
          disabled={loading}
        >
          {loading ? "登录中…" : "登录后台"}
        </button>
        <p className="mt-3 text-xs leading-relaxed text-stone-400">
          账号密码需同时在云开发「身份认证·用户管理」与后台 admins 集合中开通。
          管理账号由超级管理员在控制台创建后发放，请勿对外公开。
        </p>
      </div>
    </div>
  );
}
