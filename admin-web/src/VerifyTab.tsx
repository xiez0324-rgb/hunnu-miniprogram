import { useCallback, useEffect, useState } from "react";
import { callAdmin, invalidateAdminCache } from "./api";
import type { VerifyRow, VerifyMaterial } from "./types";
import { teacherCollegeMajorText } from "./lib/teacherIdentity";

const STATUS_TABS = ["待审核", "已通过", "已驳回", "全部"] as const;

// 学籍院校固定为平台唯一合作院校，管理端展示固定值、不再依赖用户填写
const PARTNER_SCHOOL = "湖南师范大学";

// 跨域资源下载兜底：优先 fetch 为 Blob 后强制下载；失败则新窗口打开原图（可右键另存）
async function downloadImage(url: string, name?: string) {
  try {
    const resp = await fetch(url, { mode: "cors" });
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = `${name || "材料图片"}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

interface PreviewState {
  material: VerifyMaterial;
  scale: number; // 1 | 1.5 | 2
  broken: boolean;
}

export default function VerifyTab() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("待审核");
  const [list, setList] = useState<VerifyRow[]>([]);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [brokenUrls, setBrokenUrls] = useState<string[]>([]);

  const load = useCallback(
    (force = false) => {
      if (force) invalidateAdminCache("adminListVerifications");
      setLoading(true);
      setError("");
      callAdmin<{ list: VerifyRow[] }>("adminListVerifications", { status: tab })
        .then((r) => setList(r.list || []))
        .catch((err) => setError((err as Error).message))
        .finally(() => {
          setLoading(false);
          if (force) setBrokenUrls([]); // 已重新换取链接，清空失败标记
        });
    },
    [tab]
  );

  useEffect(() => {
    load();
  }, [load]);

  const review = async (row: VerifyRow, action: "通过" | "驳回") => {
    let rejectReason = "";
    if (action === "驳回") {
      rejectReason =
        window.prompt("请输入驳回原因（会展示给老师）：", "材料照片不清晰或与学籍信息不符，请重新上传") || "";
      if (!rejectReason.trim()) return;
    }
    setBusy(row.id);
    setError("");
    try {
      await callAdmin("adminReviewVerify", { verificationId: row.id, action, rejectReason });
      // 本地移除已处理项 + 失效缓存，避免整表重拉
      invalidateAdminCache("adminListVerifications");
      invalidateAdminCache("adminDashboard");
      setList((prev) => prev.filter((v) => v.id !== row.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const openPreview = (m: VerifyMaterial) => {
    if (m.url) setPreview({ material: m, scale: 1, broken: false });
  };

  // 历史纯文本材料（无云存储图）：也能点击查看说明内容
  const openTextPreview = (m: VerifyMaterial) => {
    if (m.text) setPreview({ material: m, scale: 1, broken: false });
  };

  const cycleScale = () => {
    setPreview((p) => (p ? { ...p, scale: p.scale >= 2 ? 1 : p.scale + 0.5 } : p));
  };

  return (
    <div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="mb-3 flex gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`rounded-full px-3 py-1 text-xs ${
              tab === s ? "bg-stone-800 text-white" : "bg-white text-stone-600 border border-stone-300"
            }`}
          >
            {s === "全部" ? "全部记录" : s}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-stone-500">
        学籍院校固定为{PARTNER_SCHOOL}（平台唯一合作院校）。审核前请点开材料照片核对姓名、院校与证件是否一致；
        通过后该老师在家长端展示「已认证」标签。
      </p>

      <div className="space-y-3">
        {loading && list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            加载中…
          </p>
        ) : list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            暂无{tab === "全部" ? "" : tab}的认证申请
          </p>
        ) : (
          list.map((v) => {
            const materials = v.materials || [];
            const identity = teacherCollegeMajorText(v);
            return (
              <div key={v.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-stone-800">
                    {v.name || "未填写姓名"}
                    {identity ? `（${identity}）` : ""}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      v.status === "待审核"
                        ? "bg-amber-100 text-amber-800"
                        : v.status === "已通过"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {v.college || v.major ? `学院 · 专业：${teacherCollegeMajorText(v)} ｜ ` : ""}
                  学籍院校（固定）：{PARTNER_SCHOOL}
                  {v.authorized ? " ｜ 已授权展示学院与专业" : " ｜ 未授权展示学院与专业"}
                  {v.createTime ? ` ｜ 提交于 ${new Date(v.createTime).toLocaleString("zh-CN", { hour12: false })}` : ""}
                </p>

                {materials.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-stone-500">
                      学籍材料照片（学生证 / 学信网截图，点击查看大图）：
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {materials.map((m, idx) =>
                        m.url && !brokenUrls.includes(m.url) ? (
                          <button
                            key={idx}
                            className="group relative block h-24 w-28 overflow-hidden rounded border border-stone-200 bg-stone-100"
                            onClick={() => openPreview(m)}
                            title={m.name || "材料照片"}
                          >
                            <img
                              src={m.url}
                              alt={m.name || "材料照片"}
                              className="h-full w-full object-cover"
                              onError={() => {
                                if (m.url && !brokenUrls.includes(m.url)) {
                                  setBrokenUrls((prev) => [...prev, m.url as string]);
                                }
                              }}
                            />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[10px] text-white">
                              {m.name || "照片"}
                            </span>
                          </button>
                        ) : m.url ? (
                          <button
                            key={idx}
                            title={`${m.name || "材料"}（链接已过期）`}
                            className="flex h-24 w-28 flex-col items-center justify-center gap-1 rounded border border-dashed border-red-300 bg-red-50 p-1"
                            onClick={() => load(true)}
                          >
                            <span className="text-[10px] font-semibold text-red-500">{m.name || "照片"}</span>
                            <span className="text-[10px] text-stone-500">链接已过期</span>
                            <span className="text-[10px] text-emerald-600 underline">点击刷新</span>
                          </button>
                        ) : m.fileID ? (
                          <button
                            key={idx}
                            title={`${m.name || "材料"}（预览地址获取失败）`}
                            className="flex h-24 w-28 flex-col items-center justify-center gap-1 rounded border border-dashed border-amber-300 bg-amber-50 p-1"
                            onClick={() => load(true)}
                          >
                            <span className="text-[10px] font-semibold text-amber-700">{m.name || "照片"}</span>
                            <span className="text-[10px] text-stone-500">预览获取失败</span>
                            <span className="text-[10px] text-emerald-600 underline">点击重试</span>
                          </button>
                        ) : m.text ? (
                          <button
                            key={idx}
                            title="历史文本记录，点击查看说明"
                            className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-600 underline decoration-dotted underline-offset-2 hover:bg-stone-200"
                            onClick={() => openTextPreview(m)}
                          >
                            {m.text}（查看）
                          </button>
                        ) : (
                          <span key={idx} className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-400">
                            {m.name || "材料"}（无图片内容）
                          </span>
                        )
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-stone-400">
                      提示：图片临时链接约 2 小时后过期，若显示空白请点击右上角「刷新图片链接」。
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    该记录没有可预览的学籍材料图片（历史数据可能仅登记文本或上传未成功）。如需继续核验，
                    可先点「驳回」，通知老师重新上传清晰照片后再审核。
                  </div>
                )}

                {v.rejectReason ? (
                  <p className="mt-2 text-xs text-red-600">驳回原因：{v.rejectReason}</p>
                ) : null}

                {v.status === "待审核" ? (
                  <div className="mt-3 flex gap-2">
                    <button className="btn-p btn-p-green" disabled={busy === v.id} onClick={() => review(v, "通过")}>
                      {busy === v.id ? "处理中…" : "照片核验通过"}
                    </button>
                    <button className="btn-p btn-p-red" disabled={busy === v.id} onClick={() => review(v, "驳回")}>
                      驳回
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* 大图查看：支持缩放 / 新窗口 / 下载存档 */}
      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">
                {preview.material.name || "材料照片"}（已放大 {Math.round(preview.scale * 100)}%）
              </span>
              <button
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
                onClick={() => setPreview(null)}
              >
                关闭 ✕
              </button>
            </div>

            <div className="max-h-[70vh] max-w-full overflow-hidden rounded">
              {!preview.material.url && preview.material.text ? (
                <div className="max-w-[560px] rounded bg-stone-100 px-4 py-6 text-sm leading-relaxed text-stone-700">
                  <p className="whitespace-pre-wrap">{preview.material.text}</p>
                  <p className="mt-3 text-xs text-stone-500">
                    此条为历史文本记录，无云存储图片。如需继续核验，请先「驳回」，要求老师重新上传清晰照片。
                  </p>
                </div>
              ) : preview.broken ? (
                <div className="flex h-64 w-[420px] max-w-full flex-col items-center justify-center gap-2 bg-stone-800 text-sm text-stone-300">
                  <span>图片加载失败（临时链接可能已过期）</span>
                  <button
                    className="rounded-full bg-emerald-600 px-4 py-1 text-white hover:bg-emerald-500"
                    onClick={() => {
                      setPreview(null);
                      load(true);
                    }}
                  >
                    刷新图片链接
                  </button>
                </div>
              ) : (
                <img
                  src={preview.material.url}
                  alt={preview.material.name || "材料照片"}
                  className="cursor-zoom-in object-contain"
                  style={{ maxHeight: "70vh", maxWidth: "100%", transform: `scale(${preview.scale})` }}
                  onClick={cycleScale}
                  onError={() => setPreview((p) => (p ? { ...p, broken: true } : p))}
                />
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
                onClick={cycleScale}
              >
                {preview.scale >= 2 ? "还原大小" : "放大"}
              </button>
              <button
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
                onClick={() => preview.material.url && window.open(preview.material.url, "_blank", "noopener,noreferrer")}
              >
                新窗口打开原图
              </button>
              <button
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white hover:bg-emerald-500"
                onClick={() => preview.material.url && downloadImage(preview.material.url, preview.material.name)}
              >
                下载存档
              </button>
              <button
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
                onClick={() => {
                  setPreview(null);
                  load(true);
                }}
              >
                刷新图片链接
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-stone-400">
              点击图片可放大 / 还原；如浏览器阻止下载，请用「新窗口打开原图」后右键另存。
            </p>
          </div>
        </div>
      ) : null}

      {list.length > 0 ? (
        <div className="mt-4 flex justify-end">
          <button
            className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-600 hover:bg-stone-50"
            onClick={() => load(true)}
          >
            刷新图片链接
          </button>
        </div>
      ) : null}
    </div>
  );
}
