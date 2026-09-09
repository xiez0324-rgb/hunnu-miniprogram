import { useEffect, useState, type ReactNode } from "react";
import { callAdmin } from "../api";
import type { DemandRow, ApplicationRow, OrderRow } from "../types";
import { teacherCollegeMajorText } from "../lib/teacherIdentity";

// ============ 通用小组件 ============

function Row({ k, v }: { k: string; v?: ReactNode }) {
  if (v === undefined || v === null || v === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-stone-400">{k}</span>
      <span className="text-right font-medium text-stone-700">{v}</span>
    </div>
  );
}

function fmt(t?: string | null): string {
  if (!t) return "—";
  try {
    return new Date(t).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "—";
  }
}

// ============ 订单完整详情页 ============

interface OrderDetailProps {
  orderId: string;
  fallback?: OrderRow | null;
  onBack: () => void;
}

export function OrderDetailPage({ orderId, fallback, onBack }: OrderDetailProps) {
  const [order, setOrder] = useState<OrderRow | null>(fallback || null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (order) return;
    callAdmin<{ list: OrderRow[] }>("adminListOrders", { status: "全部", orderId })
      .then((r) => setOrder(r.list?.[0] || null))
      .catch((err) => setError((err as Error).message));
  }, [orderId, order]);

  const statusColor: Record<string, string> = {
    待联系: "bg-amber-100 text-amber-800",
    已联系: "bg-sky-100 text-sky-800",
    已成交: "bg-emerald-100 text-emerald-800",
    已取消: "bg-stone-200 text-stone-500",
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <button className="btn-p btn-p-stone" onClick={onBack}>
          ← 返回
        </button>
        <span className="text-xs text-stone-400">订单明细</span>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {!order && !error ? <p className="mt-6 text-sm text-stone-400">加载中…</p> : null}
      {order ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[order.status] || "bg-stone-100"}`}>
              {order.status}
            </span>
            <span className="text-sm font-bold text-stone-800">订单号：{order.id}</span>
            {order.confirmedAt ? <span className="text-xs text-stone-400">确认于 {fmt(order.confirmedAt)}</span> : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">家长需求</p>
              <Row k="学段科目" v={`${order.demand?.grade || "—"} ${order.demand?.subject || ""}`} />
              <Row k="类别" v={order.demand?.category} />
              <Row k="标题" v={order.demand?.title} />
              <Row k="预算(元/时)" v={order.demand?.budget} />
              <Row k="区域" v={order.demand?.area} />
              <Row k="性别要求" v={order.demand?.gender} />
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">老师</p>
              <Row k="姓名" v={`${order.teacher?.name || "—"}${order.teacher?.verified ? "（已认证）" : ""}`} />
              <Row k="学院" v={order.teacher?.college} />
              <Row k="专业" v={order.teacher?.major} />
              <Row k="可教科目" v={order.teacher?.subject} />
              <Row k="期望时薪" v={order.teacher?.rate} />
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-stone-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">家长</p>
            <Row k="称呼" v={order.parent?.nickname} />
            <Row k="联系方式" v={order.parent?.phone} />
            <Row k="所在区域" v={order.parent?.area} />
          </div>

          <div className="mt-4 space-y-1 text-xs text-stone-400">
            <p>创建时间：{fmt(order.createTime)}</p>
            {order.cancelTime ? <p>取消时间：{fmt(order.cancelTime)}</p> : null}
            <p>需求单号：{order.demand?.id || order.demandId || "—"}</p>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ============ 需求单列表页 ============

interface DemandListProps {
  status?: string;
  onBack: () => void;
}

export function DemandListPage({ status, onBack }: DemandListProps) {
  const [list, setList] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<DemandRow | null>(null);

  useEffect(() => {
    setLoading(true);
    callAdmin<{ list: DemandRow[] }>("adminListDemands", status && status !== "全部" ? { status } : {})
      .then((r) => setList(r.list || []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <button className="btn-p btn-p-stone" onClick={onBack}>
            ← 返回工作台
          </button>
          <span className="ml-3 text-sm font-bold text-stone-700">
            需求单明细{status && status !== "全部" ? `（${status}）` : ""}
            {!loading ? ` · 共 ${list.length} 条` : ""}
          </span>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">加载中…</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">暂无需求单</p>
      ) : (
        <div className="space-y-2">
          {list.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className="block w-full rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-emerald-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-stone-800">
                  {d.grade || ""} {d.subject || "?"} · {d.budget || "预算待定"}
                </span>
                <span className="flex items-center gap-2 text-xs">
                  {d.status ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{d.status}</span> : null}
                  <span className="text-stone-400">{d.applicants ?? 0} 位老师报名</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                📍 {d.area || "—"} · 👤 {d.parent?.nickname || "—"} {d.parent?.phone || ""}
                {d.createTime ? ` · ${fmt(d.createTime)}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-emerald-900">需求单详情</h3>
            <div className="mt-3 rounded-lg bg-stone-50 p-4">
              <Row k="需求单号" v={selected.id} />
              <Row k="状态" v={selected.status} />
              <Row k="学段科目" v={`${selected.grade || "—"} ${selected.subject || ""}`} />
              <Row k="类别" v={selected.category} />
              <Row k="标题" v={selected.title} />
              <Row k="预算(元/时)" v={selected.budget} />
              <Row k="区域" v={selected.area} />
              <Row k="性别要求" v={selected.gender} />
              <Row k="上课时间" v={selected.classTime} />
              <Row k="报名老师" v={`${selected.applicants ?? 0} 位`} />
              <Row k="详细要求" v={selected.desc} />
              <Row k="创建时间" v={fmt(selected.createTime)} />
            </div>
            <div className="mt-2 rounded-lg bg-stone-50 p-4">
              <Row k="家长称呼" v={selected.parent?.nickname} />
              <Row k="家长电话" v={selected.parent?.phone} />
            </div>
            <div className="mt-5 flex justify-end">
              <button className="btn-p btn-p-stone" onClick={() => setSelected(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============ 老师报名列表页 ============

interface ApplicationListProps {
  onBack: () => void;
}

export function ApplicationListPage({ onBack }: ApplicationListProps) {
  const [list, setList] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ApplicationRow | null>(null);

  useEffect(() => {
    setLoading(true);
    callAdmin<{ list: ApplicationRow[] }>("adminListApplications")
      .then((r) => setList(r.list || []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-3">
        <button className="btn-p btn-p-stone" onClick={onBack}>
          ← 返回工作台
        </button>
        <span className="ml-3 text-sm font-bold text-stone-700">老师报名明细{!loading ? ` · 共 ${list.length} 条` : ""}</span>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">加载中…</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">暂无报名记录</p>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="block w-full rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-emerald-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-stone-800">
                  🧑‍🏫 {a.teacher?.name || "—"}
                  {a.verified ? "（已认证）" : ""}
                  {teacherCollegeMajorText(a.teacher) ? ` · ${teacherCollegeMajorText(a.teacher)}` : ""}
                </span>
                <span className="text-xs text-stone-400">{fmt(a.createTime)}</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                报名需求：{a.demand?.grade || ""} {a.demand?.subject || "?"} · {a.demand?.budget || "—"} · {a.demand?.area || ""}
                {a.status ? ` · ${a.status}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-emerald-900">报名详情</h3>
            <div className="mt-3 rounded-lg bg-stone-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">老师</p>
              <Row k="姓名" v={`${selected.teacher?.name || "—"}${selected.verified ? "（已认证）" : ""}`} />
              <Row k="学院" v={selected.teacher?.college} />
              <Row k="专业" v={selected.teacher?.major} />
              <Row k="科目" v={selected.teacher?.subject} />
              <Row k="状态" v={selected.status} />
              <Row k="期望时薪" v={selected.rate} />
              <Row k="报名时间" v={fmt(selected.createTime)} />
            </div>
            <div className="mt-2 rounded-lg bg-stone-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">对应需求</p>
              <Row k="科目" v={`${selected.demand?.grade || ""} ${selected.demand?.subject || "?"}`} />
              <Row k="预算" v={selected.demand?.budget} />
              <Row k="区域" v={selected.demand?.area} />
            </div>
            <div className="mt-5 flex justify-end">
              <button className="btn-p btn-p-stone" onClick={() => setSelected(null)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
