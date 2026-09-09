import { useCallback, useEffect, useState } from "react";
import { callAdmin, invalidateAdminCache } from "./api";
import type { VerifyRow, VerifyMaterial } from "./types";

const STATUS_TABS = ["待审核", "已通过", "已驳回", "全部"] as const;

export default function VerifyTab() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("待审核");
  const [list, setList] = useState<VerifyRow[]>([]);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<VerifyMaterial | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    callAdmin<{ list: VerifyRow[] }>("adminListVerifications", { status: tab })
      .then((r) => setList(r.list || []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [tab]);

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
    if (m.url) setPreview(m);
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
        审核前请点开材料照片核对姓名、学校与证件是否一致；通过后该老师在家长端展示「已认证」标签。
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
            return (
              <div key={v.id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-stone-800">
                    {v.name || "未填写姓名"} · {v.school || "未填写学校"}
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
                  {v.authorized ? "已授权展示学校名称" : "未授权展示学校名称"}
                  {v.createTime ? ` · 提交于 ${new Date(v.createTime).toLocaleString("zh-CN", { hour12: false })}` : ""}
                </p>

                {materials.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-stone-500">学籍材料照片（点击查看大图）：</p>
                    <div className="flex flex-wrap gap-2">
                      {materials.map((m, idx) =>
                        m.url ? (
                          <button
                            key={idx}
                            className="group relative block h-24 w-28 overflow-hidden rounded border border-stone-200 bg-stone-100"
                            onClick={() => openPreview(m)}
                            title={m.name || "材料照片"}
                          >
                            <img src={m.url} alt={m.name || "材料照片"} className="h-full w-full object-cover" />
                            <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[10px] text-white">
                              {m.name || "照片"}
                            </span>
                          </button>
                        ) : m.text ? (
                          <span key={idx} className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-500">
                            {m.text}
                          </span>
                        ) : (
                          <span key={idx} className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-400">
                            {m.name || "材料"}（图片加载失败）
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

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

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="max-h-full max-w-full">
            <img src={preview.url} alt={preview.name || "材料照片"} className="max-h-[85vh] rounded object-contain" />
            <p className="mt-2 text-center text-sm text-white">{preview.name || "材料照片"}（点击空白关闭）</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
