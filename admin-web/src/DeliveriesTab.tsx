import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { callAdmin, invalidateAdminCache } from "./api";
import { groupDeliveries, type DeliveryGroup } from "./lib/deliveryAgg";
import type { DeliveryRow, TeacherResume } from "./types";

function fmt(t?: string | null): string {
  if (!t) return "—";
  try {
    return new Date(t).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return "—";
  }
}

function RateLine({ rate, rateByStage }: { rate?: string; rateByStage?: unknown }) {
  if (Array.isArray(rateByStage) && (rateByStage as { stage?: string; rate?: string }[]).length) {
    const list = rateByStage as { stage?: string; rate?: string }[];
    return (
      <div className="space-y-0.5">
        {(list[0]?.stage ? list : []).length ? (
          list.map((s, i) => (
            <p key={i} className="text-xs text-stone-600">
              {s.stage}：{s.rate || "面议"}
            </p>
          ))
        ) : (
          <p className="text-xs text-stone-600">{(rateByStage as unknown as string[])?.join(" / ") || "面议"}</p>
        )}
      </div>
    );
  }
  return <p className="text-xs text-stone-600">{rate || "面议"}</p>;
}

export default function DeliveriesTab() {
  const [list, setList] = useState<DeliveryRow[]>([]);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<null | { view: "group"; group: DeliveryGroup } | { view: "teacher"; group: DeliveryGroup; teacherId: string }>(null);

  const load = useCallback(() => {
    setLoading(true);
    callAdmin<{ list: DeliveryRow[] }>("adminListDeliveries")
      .then((r) => setList(r.list || []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => groupDeliveries(list), [list]);

  const toggleRecommend = async (row: DeliveryRow) => {
    setBusy(row.id);
    setError("");
    try {
      await callAdmin("adminRecommend", {
        demandId: row.demandId,
        teacherId: row.teacherId,
        recommended: !row.recommended,
      });
      invalidateAdminCache("adminListDeliveries");
      setList((prev) => prev.map((r) => (r.id === row.id ? { ...r, recommended: !row.recommended } : r)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const openTeacher = (group: DeliveryGroup, teacherId: string) => {
    setCurrent({ view: "teacher", group, teacherId });
  };

  // ---------- 二级页：老师完整简历 ----------
  if (current?.view === "teacher") {
    return (
      <TeacherDetailPage
        teacherId={current.teacherId}
        group={current.group}
        onBack={() => setCurrent({ view: "group", group: current.group })}
      />
    );
  }

  // ---------- 一级页：需求单 + 关联老师列表 ----------
  if (current?.view === "group") {
    const g = current.group;
    const d = g.demand;
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <button className="btn-p btn-p-stone" onClick={() => setCurrent(null)}>
          ← 返回投递列表
        </button>
        <h3 className="mt-3 text-base font-extrabold text-emerald-900">投递去向 · 家长需求</h3>
        <p className="mt-1 text-sm text-stone-500">
          {d?.grade || ""} {d?.subject || ""}
          {d?.budget ? ` · ${d.budget} 元/时` : ""}
        </p>
        <div className="mt-3 rounded-lg bg-stone-50 p-4 text-sm">
          {d?.title ? <p className="mb-1 font-medium text-stone-700">{d.title}</p> : null}
          <p className="text-stone-600">
            📍 {d?.area || "区域待定"}
            {g.parent?.nickname ? ` · 家长 ${g.parent.nickname}` : ""}
            {g.parent?.phone ? `（${g.parent.phone}）` : ""}
          </p>
          {d?.gender ? <p className="mt-0.5 text-stone-600">性别要求：{d.gender}</p> : null}
          {d?.classTime ? <p className="mt-0.5 text-stone-600">上课时间：{d.classTime}</p> : null}
          {d?.note ? <p className="mt-0.5 text-stone-600">{d.note}</p> : null}
          <p className="mt-1 text-xs text-stone-400">
            共 {g.total} 条投递记录 · {g.recommendedCount} 条平台推荐
            {g.orderStatuses.length ? ` · 订单状态：${g.orderStatuses.join(" / ")}` : ""}
          </p>
        </div>

        <p className="mt-4 text-sm font-bold text-stone-700">关联老师（{g.items.length}）</p>
        <div className="mt-2 space-y-2">
          {g.items.map((row) => (
            <div
              key={row.id}
              className="cursor-pointer rounded-lg border border-stone-200 bg-white p-4 transition hover:border-emerald-300"
              onClick={() => row.teacherId && openTeacher(g, row.teacherId)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-stone-800">
                  🧑‍🏫 {row.teacher?.name || "老师"}
                  {row.teacher?.verified ? "（已认证）" : ""}
                  {row.recommended ? " ⭐平台推荐" : ""}
                  {row.orderStatus ? ` · 已有订单：${row.orderStatus}` : ""}
                </span>
                <span className="text-xs text-stone-400">{fmt(row.createTime)}</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {row.teacher?.school ? `${row.teacher.school} · ` : ""}
                {row.teacher?.subject || ""} · {row.teacher?.rate || "时薪待议"}
                <span className="text-emerald-600"> · 点击查看完整简历 →</span>
              </p>
              {row.riskNote ? <p className="mt-1 text-xs text-red-500">⚠️ {row.riskNote}</p> : null}
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`btn-p ${row.recommended ? "btn-p-amber" : "btn-p-green"}`}
                  disabled={busy === row.id}
                  onClick={() => toggleRecommend(row)}
                >
                  {row.recommended ? "取消平台推荐" : "标记为平台推荐"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- 默认：按需求单聚合列表 ----------
  return (
    <div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <p className="mb-3 text-xs text-stone-500">
        已按「需求单」聚合：同一需求单下所有老师的投递去向归入同一单元格，点击单元格查看该需求的老师明细，点击老师可查看完整简历。
      </p>
      <div className="space-y-3">
        {loading && groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            加载中…
          </p>
        ) : groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">
            暂无投递/咨询记录
          </p>
        ) : (
          groups.map((g) => (
            <button
              key={g.demandId || `__empty__${g.items[0]?.id}`}
              onClick={() => setCurrent({ view: "group", group: g })}
              className="block w-full rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_4px_0_oklch(0.723_0.11_158/0.2)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-stone-800">{g.demandLabel}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {g.orderStatuses.map((s) => (
                    <span key={s} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                      订单 {s}
                    </span>
                  ))}
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    {g.recommendedCount} 推荐
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{g.total} 条投递</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                📍 {g.demand?.area || "—"} · 家长 {g.parent?.nickname || "—"}
                {g.parent?.phone ? `（${g.parent.phone}）` : ""}
              </p>
              <p className="mt-2 truncate text-xs text-stone-400">
                老师：{g.items.map((i) => i.teacher?.name).filter(Boolean).join("、") || "—"}
                <span className="text-emerald-600"> · 点击查看该需求下全部投递 →</span>
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ============ 老师完整简历（二级详情页） ============

function TeacherDetailPage({ teacherId, group, onBack }: { teacherId: string; group: DeliveryGroup; onBack: () => void }) {
  const [teacher, setTeacher] = useState<TeacherResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    callAdmin<{ teacher: TeacherResume }>("adminGetTeacherDetail", { teacherId })
      .then((r) => setTeacher(r.teacher || null))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [teacherId]);

  const d = group.demand;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <button className="btn-p btn-p-stone" onClick={onBack}>
        ← 返回投递去向
      </button>
      <h3 className="mt-3 text-base font-extrabold text-emerald-900">老师完整简历</h3>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="mt-4 text-sm text-stone-400">加载中…</p> : null}

      {teacher ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-lg font-extrabold text-stone-800">
                {teacher.name || "老师"}
                {teacher.verified ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">已认证</span> : null}
              </p>
              {teacher.source ? <p className="text-xs text-stone-400">数据来源：{teacher.source}</p> : null}
            </div>
            <span className="text-xs text-stone-400">{teacher.id}</span>
          </div>

          <div className="mt-4 rounded-lg bg-stone-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">基本信息</p>
            <Field k="学校" v={teacher.school} />
            <Field k="专业" v={teacher.major} />
            <Field k="学历" v={teacher.degree} />
            <Field k="性别" v={teacher.gender} />
            <Field k="教龄" v={teacher.years} />
            <Field k="可教年级" v={teacher.grades?.join("、")} />
            <Field k="可教科目" v={teacher.subjects?.join("、")} />
            <Field k="认证状态" v={teacher.verificationStatus || (teacher.verified ? "已认证" : "未认证")} />
          </div>

          <div className="mt-2 rounded-lg bg-stone-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">授课范围与时薪</p>
            <Field k="期望时薪" v={teacher.rate} custom={<RateLine rate={teacher.rate} rateByStage={teacher.rateByStage} />} />
            <Field k="可授课区域" v={teacher.districts?.join("、")} />
            <Field k="可授课时段" v={teacher.timeSlots?.join("；")} />
          </div>

          {teacher.intro ? (
            <div className="mt-2 rounded-lg bg-stone-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-700">自我介绍</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{teacher.intro}</p>
            </div>
          ) : null}

          <div className="mt-4 text-xs text-stone-400">
            本次投递需求：{d?.grade || ""} {d?.subject || ""}
            {d?.budget ? ` · ${d.budget} 元/时` : ""}
            {d?.area ? ` · ${d.area}` : ""}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ k, v, custom }: { k: string; v?: string; custom?: ReactNode }) {
  const hasCustom = custom !== undefined;
  const hasValue = v !== undefined && v !== null && v !== "";
  if (!hasCustom && !hasValue) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-stone-400">{k}</span>
      <span className="text-right font-medium text-stone-700">{custom || v}</span>
    </div>
  );
}
