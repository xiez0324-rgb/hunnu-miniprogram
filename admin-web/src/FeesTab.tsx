import { useCallback, useEffect, useState } from "react";
import { callAdmin, invalidateAdminCache } from "./api";
import type { FeeRow } from "./types";

interface EditState {
  orderId: string;
  totalFee: string;
  mode: "feeAmount" | "percent" | "none";
  value: string;
  status: string;
}

const emptyEdit = (orderId: string): EditState => ({
  orderId,
  totalFee: "",
  mode: "none",
  value: "",
  status: "待付",
});

export default function FeesTab() {
  const [list, setList] = useState<FeeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newOrderId, setNewOrderId] = useState("");
  const [edit, setEdit] = useState<EditState>(emptyEdit(""));

  const load = useCallback(() => {
    setLoading(true);
    callAdmin<{ list: FeeRow[] }>("adminListFeeRecords")
      .then((r) => setList(r.list || []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    if (!newOrderId.trim()) return;
    setEdit(emptyEdit(newOrderId.trim()));
    setShowForm(true);
  };

  const save = async () => {
    if (!edit.orderId) return;
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = {
      orderId: edit.orderId,
      status: edit.status,
    };
    const total = Number(edit.totalFee);
    if (edit.totalFee && total > 0) payload.totalFee = total;
    if (edit.mode === "feeAmount") payload.feeAmount = Number(edit.value);
    if (edit.mode === "percent") payload.ratePercent = Number(edit.value);
    try {
      await callAdmin("adminRegisterFee", payload);
      invalidateAdminCache("adminListFeeRecords");
      invalidateAdminCache("adminDashboard");
      setShowForm(false);
      setNewOrderId("");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} max-w-xs`}
          placeholder="按订单 ID 登记/修改（可粘贴订单列表中的订单号）"
          value={newOrderId}
          onChange={(e) => setNewOrderId(e.target.value)}
        />
        <button className="btn-p btn-p-green" onClick={startNew} disabled={!newOrderId.trim()}>
          登记费用
        </button>
      </div>
      <p className="mt-2 text-xs text-stone-400">
        金额/费率完全由管理员线下阶梯方案决定，可随时修改；费用仅管理端可见。
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {loading && list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            加载中…
          </p>
        ) : list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            暂无费用记录
          </p>
        ) : (
          list.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-800">
                  {f.demand || "需求单"} · {f.teacherName || "—"}
                </p>
                <p className="text-xs text-stone-500">
                  {f.orderId ? `订单 ${f.orderId}` : "未关联订单"}
                  {f.calcMode ? ` · 计算方式：${f.calcMode}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${f.status === "已付" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                  {f.status}
                </span>
                <span className="text-sm font-extrabold text-stone-700">
                  总 {f.totalFee || 0} · 费 {f.fee || 0}
                </span>
                {f.orderId ? (
                  <button
                    className="btn-p btn-p-sky"
                    onClick={() => {
                      setEdit({
                        ...emptyEdit(f.orderId || ""),
                        totalFee: String(f.totalFee || ""),
                        mode: f.fee && !f.totalFee ? "feeAmount" : "none",
                        value: f.fee ? String(f.fee) : "",
                        status: f.status || "待付",
                      });
                      setShowForm(true);
                    }}
                  >
                    编辑
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-emerald-900">费用登记 / 调整</h3>
            <p className="mt-1 break-all text-xs text-stone-400">订单：{edit.orderId}</p>

            <label className="mt-4 block text-xs font-semibold text-stone-600">总课时费（元）</label>
            <input className={inputCls} type="number" value={edit.totalFee} onChange={(e) => setEdit({ ...edit, totalFee: e.target.value })} placeholder="如 1200（费率计算时需要）" />

            <label className="mt-3 block text-xs font-semibold text-stone-600">信息费确定方式</label>
            <div className="mt-1 flex gap-3 text-sm">
              {(
                [
                  ["none", "暂不计算（仅占位待付）"],
                  ["feeAmount", "自定义金额"],
                  ["percent", "按费率计算"],
                ] as const
              ).map(([m, label]) => (
                <label key={m} className="flex items-center gap-1 text-stone-600">
                  <input type="radio" checked={edit.mode === m} onChange={() => setEdit({ ...edit, mode: m })} />
                  {label}
                </label>
              ))}
            </div>

            {edit.mode !== "none" ? (
              <div className="mt-2">
                <input
                  className={inputCls}
                  type="number"
                  value={edit.value}
                  onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                  placeholder={edit.mode === "feeAmount" ? "信息费金额，如 100" : "费率百分比，如 6"}
                />
              </div>
            ) : null}

            <label className="mt-3 block text-xs font-semibold text-stone-600">结清状态</label>
            <div className="mt-1 flex gap-3 text-sm">
              {(["待付", "已付"] as const).map((s) => (
                <label key={s} className="flex items-center gap-1 text-stone-600">
                  <input type="radio" checked={edit.status === s} onChange={() => setEdit({ ...edit, status: s })} />
                  {s === "待付" ? "待付（未结清）" : "已付（已结清）"}
                </label>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-p btn-p-stone" onClick={() => setShowForm(false)}>
                取消
              </button>
              <button className="btn-p btn-p-green" disabled={busy} onClick={save}>
                {busy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
