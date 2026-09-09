import { useCallback, useEffect, useState } from "react";
import { callAdmin, invalidateAdminCache } from "./api";
import type { OrderRow } from "./types";
import { teacherCollegeMajorText } from "./lib/teacherIdentity";
import { OrderDetailPage } from "./components/MetricPages";

const FILTERS = ["全部", "待联系", "已联系", "已成交", "已取消"];

function fmt(t?: string | null): string {
  if (!t) return "—";
  try {
    return new Date(t).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "—";
  }
}

interface Props {
  /** 从工作台数据卡进入时预设的状态筛选 */
  initialStatus?: string;
}

export default function OrdersTab({ initialStatus = "全部" }: Props) {
  const [filter, setFilter] = useState(initialStatus);
  const [list, setList] = useState<OrderRow[]>([]);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    callAdmin<{ list: OrderRow[] }>("adminListOrders", { status: filter })
      .then((r) => setList(r.list || []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const move = async (row: OrderRow, status: string) => {
    setBusy(row.id);
    setError("");
    try {
      await callAdmin("adminUpdateOrder", { orderId: row.id, status });
      // 失效相关列表缓存，本地即时更新，避免整表重拉
      invalidateAdminCache("adminListOrders");
      invalidateAdminCache("adminDashboard");
      invalidateAdminCache("adminListDeliveries");
      setList((prev) =>
        prev
          .map((r) => (r.id === row.id ? { ...r, status } : r))
          .filter((r) => filter === "全部" || r.status === filter)
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const statusColor: Record<string, string> = {
    待联系: "bg-amber-100 text-amber-800",
    已联系: "bg-sky-100 text-sky-800",
    已成交: "bg-emerald-100 text-emerald-800",
    已取消: "bg-stone-200 text-stone-500",
  };

  if (viewOrder) {
    return <OrderDetailPage orderId={viewOrder.id} fallback={viewOrder} onBack={() => setViewOrder(null)} />;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f ? "bg-emerald-700 text-white" : "bg-white text-stone-600 border border-stone-200"
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {loading && list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            加载中…
          </p>
        ) : list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            暂无该状态的订单
          </p>
        ) : (
          list.map((row) => (
            <div
              key={row.id}
              className="cursor-pointer rounded-lg border border-stone-200 bg-white p-4 transition hover:border-emerald-300"
              onClick={() => setViewOrder(row)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor[row.status] || "bg-stone-100"}`}>
                    {row.status}
                  </span>
                  <span className="text-sm font-bold text-stone-800">
                    {row.demand?.grade || ""} {row.demand?.subject || "?"} · {row.demand?.budget || "—"}
                  </span>
                </div>
                <span className="text-xs text-stone-400">{fmt(row.confirmedAt || row.createTime)}</span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-stone-500 md:grid-cols-3">
                <span>
                  🧑‍🏫 老师：{row.teacher?.name || "—"}
                  {row.teacher?.verified ? "（已认证）" : ""}
                  {teacherCollegeMajorText(row.teacher) ? ` · ${teacherCollegeMajorText(row.teacher)}` : ""}
                </span>
                <span>🧑‍🏠 家长：{row.parent?.nickname || "—"} {row.parent?.phone || ""}</span>
                <span className="text-emerald-600">📍 {row.demand?.area || "—"} · 点击查看完整详情 →</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                {row.status === "待联系" ? (
                  <>
                    <button className="btn-p btn-p-green" disabled={busy === row.id} onClick={() => move(row, "已联系")}>
                      标记已联系
                    </button>
                    <button className="btn-p btn-p-stone" disabled={busy === row.id} onClick={() => move(row, "已取消")}>
                      取消订单
                    </button>
                  </>
                ) : null}
                {row.status === "已联系" ? (
                  <>
                    <button className="btn-p btn-p-green" disabled={busy === row.id} onClick={() => move(row, "已成交")}>
                      标记已成交
                    </button>
                    <button className="btn-p btn-p-sky" disabled={busy === row.id} onClick={() => move(row, "待联系")}>
                      回退待联系
                    </button>
                    <button className="btn-p btn-p-stone" disabled={busy === row.id} onClick={() => move(row, "已取消")}>
                      取消订单
                    </button>
                  </>
                ) : null}
                {row.status === "已成交" ? (
                  <button className="btn-p btn-p-sky" disabled={busy === row.id} onClick={() => move(row, "已联系")}>
                    回退为已联系
                  </button>
                ) : null}
                {row.status === "已取消" ? (
                  <button className="btn-p btn-p-sky" disabled={busy === row.id} onClick={() => move(row, "待联系")}>
                    恢复为待联系
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
