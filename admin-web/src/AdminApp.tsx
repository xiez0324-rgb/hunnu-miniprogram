import { useState } from "react";
import LoginCard from "./LoginCard";
import Overview, { type OverviewKind } from "./Overview";
import OrdersTab from "./OrdersTab";
import VerifyTab from "./VerifyTab";
import DeliveriesTab from "./DeliveriesTab";
import FeesTab from "./FeesTab";
import { DemandListPage, ApplicationListPage } from "./components/MetricPages";
import { clearSession, cloudSignOut, getUser } from "./api";

const TABS = [
  { key: "overview", label: "工作台" },
  { key: "orders", label: "订单管理" },
  { key: "verify", label: "学籍审核" },
  { key: "deliveries", label: "投递与推荐" },
  { key: "fees", label: "费用台账" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface ViewState {
  name: TabKey | "demands" | "applications";
  status?: string;
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => Boolean(getUser().username));
  const [view, setView] = useState<ViewState>({ name: "overview" });
  const user = getUser();

  if (!authed) {
    return <LoginCard onSuccess={() => setAuthed(true)} />;
  }

  const logout = async () => {
    await cloudSignOut();
    clearSession();
    setAuthed(false);
  };

  const openFromOverview = (kind: OverviewKind) => {
    if (kind.startsWith("orders-")) {
      setView({ name: "orders", status: kind.replace("orders-", "") });
      return;
    }
    const map: Record<string, ViewState> = {
      "demands-total": { name: "demands", status: "全部" },
      "demands-active": { name: "demands", status: "进行中" },
      applications: { name: "applications" },
      verify: { name: "verify" },
      deliveries: { name: "deliveries" },
      fee: { name: "fees" },
    };
    setView(map[kind]);
  };

  const goTab = (name: TabKey) => setView({ name });

  return (
    <div className="min-h-screen bg-[#f6f3ea]">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#f6f3ea]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-800 px-2.5 py-1 text-sm font-extrabold text-white">家教后台</span>
            <span className="text-sm font-bold text-emerald-900">小小陪伴帮 · 代理人控制台</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-stone-600">
            <span>
              账号：{user.username}（{user.level}）
            </span>
            <button className="btn-p btn-p-stone" onClick={logout}>
              退出登录
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5">
        <nav className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                view.name === t.key ? "bg-emerald-700 text-white" : "border border-stone-200 bg-white text-stone-600"
              }`}
              onClick={() => goTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {view.name === "overview" ? <Overview onOpen={openFromOverview} /> : null}
        {view.name === "orders" ? <OrdersTab key={view.status || "orders"} initialStatus={view.status || "全部"} /> : null}
        {view.name === "verify" ? <VerifyTab /> : null}
        {view.name === "deliveries" ? <DeliveriesTab /> : null}
        {view.name === "fees" ? <FeesTab /> : null}
        {view.name === "demands" ? <DemandListPage status={view.status} onBack={() => goTab("overview")} /> : null}
        {view.name === "applications" ? <ApplicationListPage onBack={() => goTab("overview")} /> : null}
      </div>
    </div>
  );
}
