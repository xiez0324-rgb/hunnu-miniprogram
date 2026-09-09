import { useEffect, useState } from "react";
import { callAdmin, invalidateAdminCache } from "./api";
import type { DashData } from "./types";

export type OverviewKind =
  | "demands-total"
  | "demands-active"
  | "applications"
  | "orders-待联系"
  | "orders-已联系"
  | "orders-已成交"
  | "orders-已取消"
  | "verify"
  | "deliveries"
  | "fee";

interface Props {
  onOpen: (kind: OverviewKind) => void;
}

export default function Overview({ onOpen }: Props) {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    callAdmin<DashData>("adminDashboard")
      .then(setData)
      .catch((err) => setError((err as Error).message));
  };

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-stone-400">加载中…</p>;

  const cards: { kind: OverviewKind; label: string; value: number; hint?: string }[] = [
    { kind: "demands-total", label: "全部需求单", value: data.demands ?? 0, hint: "点击查看需求单明细" },
    { kind: "demands-active", label: "进行中需求", value: data.activeDemands ?? 0, hint: "点击查看进行中需求单" },
    { kind: "applications", label: "老师报名", value: data.applications ?? 0, hint: "点击查看报名明细" },
    { kind: "orders-待联系", label: "待联系订单", value: data.matches?.["待联系"] ?? 0, hint: "家长已确认，等待代理人跟进" },
    { kind: "orders-已联系", label: "已联系", value: data.matches?.["已联系"] ?? 0 },
    { kind: "orders-已成交", label: "已成交", value: data.matches?.["已成交"] ?? 0 },
    { kind: "orders-已取消", label: "已取消", value: data.matches?.["已取消"] ?? 0 },
    { kind: "verify", label: "待审核认证", value: data.verifications?.["待审核"] ?? 0 },
    { kind: "deliveries", label: "待处理咨询", value: data.inquiries?.["待处理"] ?? 0 },
    { kind: "fee", label: "信息费待收", value: data.fee?.["待付"] ?? 0, hint: `待收 ${data.fee?.["待付金额"] ?? 0} 元` },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-stone-400">
          在线老师 {data.users?.teacher ?? 0} 人 · 注册家长 {data.users?.parent ?? 0} 人 · 点击数据卡进入对应明细
        </p>
        <button
          className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-500 hover:text-emerald-700"
          onClick={() => {
            invalidateAdminCache("adminDashboard");
            load();
          }}
        >
          刷新数据
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.kind}
            onClick={() => onOpen(c.kind)}
            className="group rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_4px_0_oklch(0.723_0.11_158/0.25)]"
          >
            <p className="text-xs text-stone-500">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-800">{c.value}</p>
            {c.hint ? <p className="mt-1 text-xs text-stone-400">{c.hint}</p> : <p className="mt-1 text-xs text-stone-300 group-hover:text-emerald-500">点击查看明细 →</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
