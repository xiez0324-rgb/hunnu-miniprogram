import { useState } from "react";

/* ========== 撕纸风样式工具 ========== */
const tornCard = "torn";
const shadowPaper = "shadow-[0_6px_0_oklch(0.321_0.029_167.6/0.15)]";
const shadowBtn = "shadow-[0_4px_0_oklch(0.367_0.059_178.2/0.35)]";
const shadowBtnActive = "translate-y-[2px] shadow-[0_2px_0_oklch(0.367_0.059_178.2/0.35)]";

/** 复制文本到剪贴板：优先 Clipboard API，失败则回退到 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续走回退方案 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ========== 模拟数据 ========== */

type PendingOrder = {
  id: string;
  demandId: string;
  teacher: string;
  parent: string;
  parentPhone: string;
  teacherPhone: string;
  matchedAt: string;
  contacted: boolean;
};

const initialPending: PendingOrder[] = [
  { id: "p1", demandId: "1024", teacher: "李思", parent: "王女士", parentPhone: "138-6688-1201", teacherPhone: "188-7315-2211", matchedAt: "今天 10:24", contacted: false },
  { id: "p2", demandId: "1031", teacher: "刘洋", parent: "陈先生", parentPhone: "139-7311-5520", teacherPhone: "186-8486-3322", matchedAt: "今天 09:47", contacted: false },
  { id: "p3", demandId: "1027", teacher: "张一凡", parent: "李女士", parentPhone: "135-0746-8890", teacherPhone: "187-1107-6601", matchedAt: "昨天 21:05", contacted: true },
];

type VerifyItem = {
  id: string;
  name: string;
  school: string;
  submittedAt: string;
  status: "待审核" | "已通过" | "已驳回";
  studentCard?: string;      // 学生证照片
  chsiScreenshot?: string;   // 学信网截图
  showSchool: boolean;       // 授权在简历中展示学校名称
};

const initialVerify: VerifyItem[] = [
  { id: "v1", name: "周杰", school: "中南大学 · 数学系", submittedAt: "今天 11:02", status: "待审核", studentCard: "学生证照片.jpg", chsiScreenshot: "学信网学籍截图.png", showSchool: true },
  { id: "v2", name: "赵敏", school: "湖南师大 · 体育学院", submittedAt: "今天 08:41", status: "待审核", studentCard: "学生证照片.jpg", chsiScreenshot: "学信网学籍截图.png", showSchool: true },
  { id: "v3", name: "陈晨", school: "湖南大学 · 艺术系", submittedAt: "昨天 18:20", status: "待审核", studentCard: "学生证照片.jpg", chsiScreenshot: "学信网学籍截图.png", showSchool: false },
];

type Unresponded = {
  id: string;
  parent: string;
  phone: string;
  demand: string;
  waiting: string;
  urged: boolean;
};

const initialUnresponded: Unresponded[] = [
  { id: "u1", parent: "王女士", phone: "138-6688-1201", demand: "#1024 初三·数学", waiting: "已等待 36 小时", urged: false },
  { id: "u2", parent: "刘先生", phone: "137-8721-3399", demand: "#1026 高二·英语", waiting: "已等待 52 小时", urged: true },
];

type FeeRecord = {
  id: string;
  demand: string;
  teacher: string;
  totalFee: number;
  fee8: number;
  collected: boolean;
};

const initialFees: FeeRecord[] = [
  { id: "f1", demand: "#1012 初三·数学", teacher: "王晨", totalFee: 1200, fee8: 96, collected: false },
  { id: "f2", demand: "#1015 五年级·数学", teacher: "李思", totalFee: 800, fee8: 64, collected: true },
  { id: "f3", demand: "#1018 高二·英语", teacher: "周杰", totalFee: 1500, fee8: 120, collected: false },
];

type RecommendItem = {
  id: string;
  demand: string;
  parent: string;
  candidates: { name: string; verified: boolean; recommended: boolean }[];
};

const initialRecommend: RecommendItem[] = [
  {
    id: "r1",
    demand: "#1024 初三·数学 王女士",
    parent: "王女士",
    candidates: [
      { name: "李思", verified: true, recommended: true },
      { name: "王晨", verified: true, recommended: false },
      { name: "周杰", verified: false, recommended: false },
    ],
  },
  {
    id: "r2",
    demand: "#1025 五年级·数学 陈先生",
    parent: "陈先生",
    candidates: [
      { name: "刘洋", verified: true, recommended: false },
      { name: "李思", verified: true, recommended: false },
    ],
  },
];

const deliveryData = [
  { teacher: "王晨", school: "湖南大学", count: 9, recent: ["#1024 初三·数学 · 已推荐", "#1025 五年级·数学 · 已报名", "#1026 高二·英语 · 已取消"] },
  { teacher: "李思", school: "湖南师大", count: 7, recent: ["#1024 初三·英语 · 已成交", "#1025 五年级·数学 · 已推荐", "#1027 四年级·编程 · 已报名"] },
  { teacher: "周杰", school: "中南大学", count: 14, recent: ["#1018 高二·英语 · 已取消", "#1019 初一·数学 · 已取消", "#1021 高一·数学 · 已成交"] },
  { teacher: "赵敏", school: "湖南师大", count: 3, recent: ["#1028 六年级·羽毛球 · 已报名"] },
];

const matchRecords = [
  { id: "#1024", teacher: "李思", parent: "王女士", matchedAt: "今天 10:24", status: "待联系" },
  { id: "#1031", teacher: "刘洋", parent: "陈先生", matchedAt: "今天 09:47", status: "待联系" },
  { id: "#1018", teacher: "周杰", parent: "刘先生", matchedAt: "昨天 15:30", status: "已对接" },
  { id: "#1012", teacher: "王晨", parent: "张女士", matchedAt: "08-28 09:12", status: "已成交" },
  { id: "#1009", teacher: "李思", parent: "王女士", matchedAt: "08-26 16:40", status: "已成交" },
  { id: "#1015", teacher: "陈晨", parent: "赵先生", matchedAt: "08-24 11:03", status: "已取消" },
];

/* ========== 撕纸风通用组件 ========== */

function PaperCard({ children, rotate = 0, className = "" }: { children: React.ReactNode; rotate?: number; className?: string }) {
  return (
    <div
      className={`bg-[color:var(--surface)] ${tornCard} ${shadowPaper} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </div>
  );
}

function StickerBtn({
  children,
  onClick,
  tone = "leaf",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "leaf" | "pine" | "amber" | "sky" | "ghost";
  disabled?: boolean;
}) {
  const tones: Record<string, string> = {
    leaf: "bg-[color:var(--leaf)] text-white border-[color:var(--pine)]",
    pine: "bg-[color:var(--pine)] text-white border-[color:var(--pine)]",
    amber: "bg-[color:var(--amber)] text-[color:var(--pine)] border-[color:var(--pine)]",
    sky: "bg-[color:var(--sky)] text-[color:var(--pine)] border-[color:var(--pine)]",
    ghost: "bg-white text-[color:var(--pine)] border-[color:var(--pine)]",
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center px-4 py-2 text-xs font-bold font-body border-2 rounded-full ${tones[tone]} ${shadowBtn} active:${shadowBtnActive} transition-transform disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function HandTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`font-[family-name:var(--font-hand)] text-[color:var(--pine)] ${className}`}>
      {children}
    </h2>
  );
}

function StatPaper({ label, value, note, rotate = -1 }: { label: string; value: number; note: string; rotate?: number }) {
  return (
    <PaperCard rotate={rotate} className="p-4">
      <p className="text-[11px] font-bold text-[color:var(--ink)]/60 font-body">{label}</p>
      <p className="text-3xl font-extrabold text-[color:var(--pine)] mt-1 font-body">{value}</p>
      <p className="text-[10px] text-[color:var(--ink)]/50 mt-1 font-body">{note}</p>
    </PaperCard>
  );
}

function Phone({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[color:var(--pine)] bg-[color:var(--amber)]/30 border-2 border-[color:var(--pine)]/20 rounded-full px-2 py-0.5 font-body">
      ☎ {value}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[11px] font-bold text-[color:var(--pine)]/70 uppercase tracking-wider whitespace-nowrap font-body">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-xs text-[color:var(--ink)] font-body ${className}`}>{children}</td>;
}

function StatusSticker({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    "待审核": { bg: "bg-[color:var(--amber)]/40", text: "text-[color:var(--pine)]", border: "border-[color:var(--pine)]/30" },
    "已通过": { bg: "bg-[color:var(--leaf)]/25", text: "text-[color:var(--pine)]", border: "border-[color:var(--pine)]/30" },
    "已驳回": { bg: "bg-slate-200/80", text: "text-slate-500", border: "border-slate-300" },
    "已联系": { bg: "bg-[color:var(--leaf)]/25", text: "text-[color:var(--pine)]", border: "border-[color:var(--pine)]/30" },
    "待联系": { bg: "bg-[color:var(--amber)]/40", text: "text-[color:var(--pine)]", border: "border-[color:var(--pine)]/30" },
    "已对接": { bg: "bg-[color:var(--sky)]/30", text: "text-[color:var(--pine)]", border: "border-[color:var(--pine)]/30" },
    "已成交": { bg: "bg-[color:var(--leaf)]/30", text: "text-[color:var(--pine)]", border: "border-[color:var(--pine)]/30" },
    "已取消": { bg: "bg-slate-200/80", text: "text-slate-500", border: "border-slate-300" },
    "未收": { bg: "bg-[color:var(--amber)]/40", text: "text-[color:var(--pine)]", border: "border-[color:var(--pine)]/30" },
    "已收": { bg: "bg-[color:var(--leaf)]/25", text: "text-[color:var(--pine)]", border: "border-[color:var(--pine)]/30" },
  };
  const s = map[status] || { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };
  return (
    <span className={`inline-block text-[10px] font-bold font-body rounded-full px-2.5 py-1 border-2 ${s.bg} ${s.text} ${s.border}`}>
      {status}
    </span>
  );
}

/* ========== 导航配置 ========== */

const sections = [
  { key: "dashboard", label: "仪表盘", icon: "▦" },
  { key: "pending", label: "待处理订单", icon: "⚡" },
  { key: "verify", label: "待审查学籍", icon: "🪪" },
  { key: "recommend", label: "推荐管理", icon: "★" },
  { key: "unresponded", label: "未回应家长", icon: "⏰" },
  { key: "delivery", label: "投递去向", icon: "➤" },
  { key: "match", label: "匹配记录", icon: "⇄" },
  { key: "fee", label: "收费登记", icon: "¥" },
] as const;

type SectionKey = (typeof sections)[number]["key"];

/* ========== 与小程序端共享的订单状态 ========== */

/** 家长在小程序端确认老师后产生的订单，回传给代理人后台跟进 */
export type SharedOrder = {
  id: string;
  demandId: string;
  teacher: string;
  parent: string;
  parentPhone: string;
  teacherPhone: string;
  status: "待联系" | "已联系" | "已成交";
};

type AdminPanelProps = {
  externalOrders?: SharedOrder[];
  onOrderStatusChange?: (id: string, status: SharedOrder["status"]) => void;
  /** 家长在确认主选后，还想进一步了解/试课的备选老师（小程序端回传） */
  parentInterests?: { demandId: string; teacher: string; parent: string }[];
};

/* ========== 主面板 ========== */

export default function AdminPanel({ externalOrders = [], onOrderStatusChange, parentInterests = [] }: AdminPanelProps = {}) {
  const [active, setActive] = useState<SectionKey>("dashboard");
  const [pending, setPending] = useState(initialPending);
  const [verify, setVerify] = useState(initialVerify);
  const [unresponded, setUnresponded] = useState(initialUnresponded);
  const [fees, setFees] = useState(initialFees);
  const [recommend, setRecommend] = useState(initialRecommend);
  const [search, setSearch] = useState("");
  const [previewTarget, setPreviewTarget] = useState<VerifyItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyContact = async (id: string, text: string) => {
    await copyText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  };

  /* ========== 全局搜索：跨模块子串匹配 ========== */
  const q = search.trim().toLowerCase();
  const hasQuery = q.length > 0;
  const searchHits: { source: string; title: string; sub: string }[] = [];

  if (hasQuery) {
    const hit = (source: string, title: string, sub: string) => searchHits.push({ source, title, sub });
    pending.forEach((p) => {
      if ([p.demandId, p.teacher, p.parent, p.parentPhone, p.teacherPhone].some((v) => v.toLowerCase().includes(q)))
        hit("待处理订单", `#${p.demandId} · ${p.teacher} ↔ ${p.parent}`, `${p.parentPhone} / ${p.teacherPhone}`);
    });
    verify.forEach((v) => {
      if ([v.name, v.school].some((x) => x.toLowerCase().includes(q))) hit("待审查学籍", `${v.name} · ${v.school}`, v.status);
    });
    recommend.forEach((r) => {
      if ([r.demand, r.parent, ...r.candidates.map((c) => c.name)].some((x) => x.toLowerCase().includes(q)))
        hit("推荐管理", r.demand, `家长：${r.parent}`);
    });
    unresponded.forEach((u) => {
      if ([u.parent, u.phone, u.demand].some((x) => x.toLowerCase().includes(q))) hit("未回应家长", `${u.parent} · ${u.demand}`, u.waiting);
    });
    fees.forEach((f) => {
      if ([f.demand, f.teacher].some((x) => x.toLowerCase().includes(q))) hit("收费登记", `${f.demand} · ${f.teacher}`, `${f.fee8} 元信息费`);
    });
    deliveryData.forEach((d) => {
      if ([d.teacher, d.school].some((x) => x.toLowerCase().includes(q))) hit("投递去向", `${d.teacher} · ${d.school}`, `近 7 天 ${d.count} 次`);
    });
    matchRecords.forEach((m) => {
      if ([m.id, m.teacher, m.parent].some((x) => x.toLowerCase().includes(q))) hit("匹配记录", `${m.id} · ${m.teacher} ↔ ${m.parent}`, m.status);
    });
    externalOrders.forEach((o) => {
      if ([o.demandId, o.teacher, o.parent, o.parentPhone, o.teacherPhone].some((x) => x.toLowerCase().includes(q)))
        hit("家长已确认", `#${o.demandId} · ${o.teacher} ↔ ${o.parent}`, o.status);
    });
  }

  /* ========== 投递风控：近 7 天投递过多或取消次数超标 ========== */
  const riskAlerts = deliveryData
    .map((d) => ({ teacher: d.teacher, count: d.count, cancelled: d.recent.filter((r) => r.includes("已取消")).length }))
    .filter((x) => x.count >= 10 || x.cancelled >= 2);

  return (
    <div className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)] font-[family-name:var(--font-body)]">
      {/* 顶部纸胶带装饰 */}
      <div className="h-2 bg-[repeating-linear-gradient(45deg,var(--leaf),var(--leaf)_12px,var(--mint)_12px,var(--mint)_24px)]" />

      <div className="flex">
        {/* 侧边栏：撕纸手账风格 */}
        <aside className="w-56 shrink-0 bg-[color:var(--paper)] sticky top-0 h-screen border-r-4 border-dashed border-[color:var(--pine)]/20">
          <div className="px-4 py-5 border-b-4 border-dashed border-[color:var(--pine)]/20">
            <p className="font-[family-name:var(--font-hand)] text-2xl text-[color:var(--pine)] leading-none">家教后台</p>
            <p className="text-[10px] text-[color:var(--ink)]/50 mt-1 font-body">Agent Console · 小小陪伴帮</p>
          </div>

          {/* 侧边撕纸贴纸装饰 */}
          <div className="px-4 py-3">
            <PaperCard rotate={-2} className="py-2 px-3">
              <p className="font-[family-name:var(--font-hand)] text-sm text-[color:var(--pine)]">今日待办</p>
              <p className="text-[10px] text-[color:var(--ink)]/60 mt-0.5">
                {pending.filter((p) => !p.contacted).length} 待联系 · {verify.filter((v) => v.status === "待审核").length} 待审查
              </p>
            </PaperCard>
          </div>

          <nav className="flex-1 px-3 pb-3">
            {sections.map((s) => {
              const isActive = active === s.key;
              const badgeCount =
                s.key === "pending"
                  ? pending.filter((p) => !p.contacted).length + externalOrders.filter((o) => o.status === "待联系").length
                  : s.key === "verify" ? verify.filter((v) => v.status === "待审核").length :
                s.key === "unresponded" ? unresponded.filter((u) => !u.urged).length : 0;

              return (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] font-bold font-body rounded-lg mb-1 transition-all ${
                    isActive
                      ? "bg-[color:var(--pine)] text-[color:var(--surface)] border-2 border-[color:var(--pine)] shadow-[0_3px_0_oklch(0.321_0.029_167.6/0.3)]"
                      : "text-[color:var(--ink)]/70 hover:bg-[color:var(--mint)]/40 hover:text-[color:var(--pine)]"
                  }`}
                >
                  <span className="text-base">{s.icon}</span>
                  <span className="flex-1">{s.label}</span>
                  {badgeCount > 0 && (
                    <span className={`inline-flex items-center justify-center text-[10px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 ${
                      isActive
                        ? "bg-[color:var(--amber)] text-[color:var(--pine)]"
                        : "bg-[color:var(--amber)] text-[color:var(--pine)]"
                    }`}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="px-4 py-3 border-t-4 border-dashed border-[color:var(--pine)]/20">
            <PaperCard rotate={1} className="p-2">
              <p className="text-[10px] text-[color:var(--ink)]/60 font-body leading-relaxed">
                🔒 仅限代理<br/>人账号登录
                <br/>
                📱 移动端可访问
              </p>
            </PaperCard>
          </div>
        </aside>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {/* 顶部栏 */}
          <header className="bg-[color:var(--surface)] border-b-4 border-dashed border-[color:var(--pine)]/20 px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[color:var(--pine)] text-[color:var(--surface)] grid place-items-center font-extrabold font-body border-2 border-[color:var(--pine)]">
                管
              </div>
              <div className="leading-tight">
                <p className="font-[family-name:var(--font-hand)] text-xl text-[color:var(--pine)]">运营管理员</p>
                <p className="text-[10px] text-[color:var(--ink)]/50 font-body">平台自营 · 代理人 Kiki</p>
              </div>
            </div>

            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索 需求 # / 老师 / 家长 / 电话"
                  className="w-full rounded-full border-2 border-[color:var(--pine)]/30 bg-[color:var(--paper)] px-5 py-2 text-xs font-body text-[color:var(--ink)] outline-none focus:border-[color:var(--pine)] focus:shadow-[0_3px_0_oklch(0.321_0.029_167.6/0.15)] transition-shadow"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--pine)]/40 text-sm">🔍</span>
              </div>
            </div>
          </header>

          <main className="p-6">
            {hasQuery ? (
              <div className="space-y-4">
                <HandTitle className="text-3xl">🔍 搜索结果</HandTitle>
                <p className="text-xs text-[color:var(--ink)]/60 font-body">匹配到 {searchHits.length} 条，关键词「{search}」</p>
                {searchHits.length === 0 ? (
                  <PaperCard rotate={-0.5} className="p-6 text-center text-xs text-[color:var(--ink)]/40 font-body">未找到匹配项，换个关键词试试</PaperCard>
                ) : (
                  <PaperCard rotate={0} className="px-3">
                    <table className="w-full">
                      <thead className="bg-[color:var(--mint)]/20">
                        <tr><Th>分类</Th><Th>内容</Th><Th>备注</Th></tr>
                      </thead>
                      <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                        {searchHits.map((h, i) => (
                          <tr key={i}>
                            <Td><span className="inline-block text-[10px] font-bold font-body bg-[color:var(--amber)]/30 border-2 border-[color:var(--pine)]/20 rounded-full px-2 py-0.5 text-[color:var(--pine)]">{h.source}</span></Td>
                            <Td className="font-bold text-[color:var(--pine)]">{h.title}</Td>
                            <Td className="text-[color:var(--ink)]/50">{h.sub}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </PaperCard>
                )}
              </div>
            ) : (
              <>
            {/* 仪表盘 */}
            {active === "dashboard" && (
              <div className="space-y-6">
                <HandTitle className="text-3xl">📋 今日工作台</HandTitle>

                {/* 统计卡片 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatPaper
                    label="待处理订单"
                    value={pending.filter((p) => !p.contacted).length + externalOrders.filter((o) => o.status === "待联系").length}
                    note="已匹配，未联系"
                    rotate={-1}
                  />
                  <StatPaper label="待审查学籍" value={verify.filter((v) => v.status === "待审核").length} note="人工核验中" rotate={1} />
                  <StatPaper label="未回应家长" value={unresponded.filter((u) => !u.urged).length} note="已推送，未确认" rotate={0.5} />
                  <StatPaper label="今日新需求" value={8} note="比昨日 +3" rotate={-0.5} />
                </div>

                {/* 待处理订单表格 */}
                <PaperCard rotate={-0.3} className="px-3">
                  <div className="px-5 py-4 border-b-4 border-dashed border-[color:var(--pine)]/20 flex items-center justify-between">
                    <HandTitle className="text-xl">⚡ 待处理订单</HandTitle>
                    <button
                      onClick={() => setActive("pending")}
                      className="text-xs font-bold text-[color:var(--leaf)] hover:text-[color:var(--pine)] underline underline-offset-4 decoration-dotted font-body"
                    >
                      查看全部 →
                    </button>
                  </div>
                  <table className="w-full">
                    <thead className="bg-[color:var(--mint)]/20">
                      <tr>
                        <Th>需求</Th>
                        <Th>老师</Th>
                        <Th>家长</Th>
                        <Th>双方电话</Th>
                        <Th>匹配时间</Th>
                        <Th>操作</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                      {pending.map((p) => (
                        <tr key={p.id}>
                          <Td className="font-extrabold text-[color:var(--pine)]">#{p.demandId}</Td>
                          <Td>{p.teacher}</Td>
                          <Td>{p.parent}</Td>
                          <Td>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Phone value={p.parentPhone} />
                              <Phone value={p.teacherPhone} />
                            </div>
                          </Td>
                          <Td className="text-[color:var(--ink)]/50">{p.matchedAt}</Td>
                          <Td>
                            {p.contacted ? (
                              <StatusSticker status="已联系" />
                            ) : (
                              <StickerBtn
                                tone="pine"
                                onClick={() => {
                                  handleCopyContact(p.id, `家长 ${p.parentPhone} · 老师 ${p.teacherPhone}`);
                                  setPending((list) =>
                                    list.map((x) => (x.id === p.id ? { ...x, contacted: true } : x)),
                                  );
                                }}
                              >
                                {copiedId === p.id ? "✓ 已复制" : "📞 复制并联系"}
                              </StickerBtn>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PaperCard>
              </div>
            )}

            {/* 待处理订单 */}
            {active === "pending" && (
              <div className="space-y-4">
                <HandTitle className="text-3xl">⚡ 待处理订单</HandTitle>
                <p className="text-xs text-[color:var(--ink)]/60 font-body">已匹配成功但尚未私下联系的订单，优先跟进</p>

                <PaperCard rotate={0.5} className="px-3">
                  <table className="w-full">
                    <thead className="bg-[color:var(--amber)]/25">
                      <tr>
                        <Th>需求</Th>
                        <Th>老师</Th>
                        <Th>家长</Th>
                        <Th>家长电话</Th>
                        <Th>老师电话</Th>
                        <Th>匹配时间</Th>
                        <Th>状态</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                      {pending.map((p) => (
                        <tr key={p.id} className={p.contacted ? "opacity-50" : ""}>
                          <Td className="font-extrabold text-[color:var(--pine)]">#{p.demandId}</Td>
                          <Td>{p.teacher}</Td>
                          <Td>{p.parent}</Td>
                          <Td><Phone value={p.parentPhone} /></Td>
                          <Td><Phone value={p.teacherPhone} /></Td>
                          <Td className="text-[color:var(--ink)]/50">{p.matchedAt}</Td>
                          <Td>
                            {p.contacted ? (
                              <StatusSticker status="已联系" />
                            ) : (
                              <StickerBtn
                                tone="leaf"
                                onClick={() =>
                                  setPending((list) =>
                                    list.map((x) => (x.id === p.id ? { ...x, contacted: true } : x)),
                                  )
                                }
                              >
                                标记已联系
                              </StickerBtn>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PaperCard>

                {/* 家长在小程序端确认老师后回传的订单 */}
                <PaperCard rotate={-0.5} className="px-3">
                  <div className="px-5 py-3 border-b-4 border-dashed border-[color:var(--pine)]/20">
                    <HandTitle className="text-lg">家长已确认（待对接）</HandTitle>
                    <p className="text-[10px] text-[color:var(--ink)]/50 mt-0.5 font-body">家长在小程序端确认人选后自动进入此队列，联系后登记成交即可关闭订单</p>
                  </div>
                  {externalOrders.length === 0 ? (
                    <p className="px-5 py-6 text-center text-xs text-[color:var(--ink)]/40 font-body">暂无家长确认的订单</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-[color:var(--sky)]/25">
                        <tr>
                          <Th>需求</Th>
                          <Th>老师</Th>
                          <Th>家长</Th>
                          <Th>家长电话</Th>
                          <Th>老师电话</Th>
                          <Th>匹配时间</Th>
                          <Th>状态 / 操作</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                        {externalOrders.map((o) => (
                          <tr key={o.id}>
                            <Td className="font-extrabold text-[color:var(--pine)]">#{o.demandId}</Td>
                            <Td>{o.teacher}</Td>
                            <Td>{o.parent}</Td>
                            <Td><Phone value={o.parentPhone} /></Td>
                            <Td><Phone value={o.teacherPhone} /></Td>
                            <Td className="text-[color:var(--ink)]/50">刚刚</Td>
                            <Td>
                              {o.status === "待联系" ? (
                                <StickerBtn
                                  tone="pine"
                                  onClick={() => {
                                    handleCopyContact(o.id, `家长 ${o.parentPhone} · 老师 ${o.teacherPhone}`);
                                    onOrderStatusChange?.(o.id, "已联系");
                                  }}
                                >
                                  {copiedId === o.id ? "✓ 已复制" : "📞 复制并联系"}
                                </StickerBtn>
                              ) : o.status === "已联系" ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <StatusSticker status="已联系" />
                                  <StickerBtn tone="leaf" onClick={() => onOrderStatusChange?.(o.id, "已成交")}>
                                    关闭订单（成交）
                                  </StickerBtn>
                                </div>
                              ) : (
                                <StatusSticker status="已成交" />
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </PaperCard>

                {/* 家长还想进一步了解的备选老师（主选确认后仍想试课） */}
                {parentInterests.length > 0 && (
                  <PaperCard rotate={0.6} className="px-3 border-l-8 border-l-[color:var(--amber)]">
                    <div className="px-5 py-3 border-b-4 border-dashed border-[color:var(--pine)]/20">
                      <HandTitle className="text-lg">🧪 家长还想试课的备选</HandTitle>
                      <p className="text-[10px] text-[color:var(--ink)]/50 mt-0.5 font-body">
                        家长已确认主选老师，但希望同时安排以下老师试课/进一步了解，建议尽快协调档期
                      </p>
                    </div>
                    <div className="px-5 py-3 space-y-2">
                      {parentInterests.map((it, i) => (
                        <div key={`${it.demandId}-${it.teacher}`} className="flex items-center justify-between gap-3 text-xs font-body">
                          <span className="font-bold text-[color:var(--pine)]">#{it.demandId}</span>
                          <span className="flex-1">
                            {it.teacher} <span className="text-[color:var(--ink)]/50">← 家长：{it.parent}</span>
                          </span>
                          <StickerBtn tone="amber" onClick={() => handleCopyContact(`it-${i}`, `${it.parent} 需求#${it.demandId}，想了解老师：${it.teacher}`)}>
                            {copiedId === `it-${i}` ? "✓ 已复制" : "复制备注"}
                          </StickerBtn>
                        </div>
                      ))}
                    </div>
                  </PaperCard>
                )}
              </div>
            )}

            {/* 待审查学籍 */}
            {active === "verify" && (
              <div className="space-y-4">
                <HandTitle className="text-3xl">🪪 待审查学籍</HandTitle>
                <p className="text-xs text-[color:var(--ink)]/60 font-body">人工核验学生证 / 学信网截图，通过后打「已认证」标签</p>

                <PaperCard rotate={-0.5} className="px-3">
                  <table className="w-full">
                    <thead className="bg-[color:var(--sky)]/25">
                      <tr>
                        <Th>老师</Th>
                        <Th>学校</Th>
                        <Th>提交时间</Th>
                        <Th>材料</Th>
                        <Th>状态</Th>
                        <Th>操作</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                      {verify.map((v) => (
                        <tr key={v.id}>
                          <Td className="font-extrabold text-[color:var(--pine)]">{v.name}</Td>
                          <Td>{v.school}</Td>
                          <Td className="text-[color:var(--ink)]/50">{v.submittedAt}</Td>
                          <Td>
                            <button
                              onClick={() => setPreviewTarget(v)}
                              className="text-[10px] font-bold font-body bg-[color:var(--mint)]/40 border-2 border-[color:var(--pine)]/20 rounded-full px-2 py-0.5 text-[color:var(--pine)] hover:bg-[color:var(--mint)]/70 hover:border-[color:var(--pine)]/40 transition-colors cursor-pointer"
                            >
                              📎 查看认证
                            </button>
                          </Td>
                          <Td><StatusSticker status={v.status} /></Td>
                          <Td>
                            {v.status === "待审核" ? (
                              <div className="flex gap-2">
                                <StickerBtn
                                  tone="leaf"
                                  onClick={() =>
                                    setVerify((list) =>
                                      list.map((x) => (x.id === v.id ? { ...x, status: "已通过" } : x)),
                                    )
                                  }
                                >
                                  ✓ 通过
                                </StickerBtn>
                                <StickerBtn
                                  tone="ghost"
                                  onClick={() =>
                                    setVerify((list) =>
                                      list.map((x) => (x.id === v.id ? { ...x, status: "已驳回" } : x)),
                                    )
                                  }
                                >
                                  ✗ 驳回
                                </StickerBtn>
                              </div>
                            ) : (
                              <span className="text-xs text-[color:var(--ink)]/30 font-body">—</span>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PaperCard>
              </div>
            )}

            {/* 推荐管理 */}
            {active === "recommend" && (
              <div className="space-y-5">
                <HandTitle className="text-3xl">★ 推荐管理</HandTitle>
                <p className="text-xs text-[color:var(--ink)]/60 font-body">勾选推荐人选后家长端即时置顶展示</p>

                {recommend.map((r, idx) => (
                  <PaperCard rotate={idx % 2 === 0 ? -0.8 : 0.8} key={r.id} className="px-3">
                    <div className="px-5 py-3 border-b-4 border-dashed border-[color:var(--pine)]/20">
                      <HandTitle className="text-lg">{r.demand}</HandTitle>
                      <p className="text-[10px] text-[color:var(--ink)]/50 mt-0.5 font-body">家长：{r.parent}</p>
                    </div>
                    <table className="w-full">
                      <thead className="bg-[color:var(--mint)]/20">
                        <tr>
                          <Th>候选老师</Th>
                          <Th>认证状态</Th>
                          <Th>操作</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                        {r.candidates.map((c) => (
                          <tr key={c.name}>
                            <Td className="font-extrabold text-[color:var(--pine)]">{c.name}</Td>
                            <Td>
                              {c.verified ? (
                                <span className="inline-block text-[10px] font-bold font-body bg-[color:var(--leaf)]/25 border-2 border-[color:var(--pine)]/30 rounded-full px-2.5 py-1 text-[color:var(--pine)]">
                                  ✓ 已认证
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] font-bold font-body bg-slate-100 border-2 border-slate-300 rounded-full px-2.5 py-1 text-slate-500">
                                  未认证
                                </span>
                              )}
                            </Td>
                            <Td>
                              {c.recommended ? (
                                <span className="text-xs font-bold text-[color:var(--pine)] font-body">
                                  ⭐ 已推荐给家长
                                </span>
                              ) : (
                                <StickerBtn
                                  tone="amber"
                                  onClick={() =>
                                    setRecommend((list) =>
                                      list.map((x) =>
                                        x.id === r.id
                                          ? {
                                              ...x,
                                              candidates: x.candidates.map((y) =>
                                                y.name === c.name ? { ...y, recommended: true } : y,
                                              ),
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                >
                                  ★ 推荐给家长
                                </StickerBtn>
                              )}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-5 py-2 text-[10px] text-[color:var(--ink)]/50 border-t-4 border-dashed border-[color:var(--pine)]/10 font-body bg-[color:var(--amber)]/10">
                      💡 推荐后家长端「平台推荐」区即时置顶展示；家长确认后自动转入待处理订单并通知
                    </div>
                  </PaperCard>
                ))}
              </div>
            )}

            {/* 未回应家长 */}
            {active === "unresponded" && (
              <div className="space-y-4">
                <HandTitle className="text-3xl">⏰ 未回应家长</HandTitle>
                <p className="text-xs text-[color:var(--ink)]/60 font-body">已推送人选但超过时限未确认的家长，需催办</p>

                <PaperCard rotate={0.3} className="px-3">
                  <table className="w-full">
                    <thead className="bg-[color:var(--amber)]/30">
                      <tr>
                        <Th>家长</Th>
                        <Th>电话</Th>
                        <Th>关联需求</Th>
                        <Th>等待时长</Th>
                        <Th>操作</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                      {unresponded.map((u) => (
                        <tr key={u.id}>
                          <Td className="font-extrabold text-[color:var(--pine)]">{u.parent}</Td>
                          <Td><Phone value={u.phone} /></Td>
                          <Td>{u.demand}</Td>
                          <Td className="font-bold text-[color:var(--pine)]">{u.waiting}</Td>
                          <Td>
                            {u.urged ? (
                              <StatusSticker status="已对接" />
                            ) : (
                              <StickerBtn
                                tone="amber"
                                onClick={() =>
                                  setUnresponded((list) =>
                                    list.map((x) => (x.id === u.id ? { ...x, urged: true } : x)),
                                  )
                                }
                              >
                                📞 电话催办
                              </StickerBtn>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PaperCard>
              </div>
            )}

            {/* 投递去向 */}
            {active === "delivery" && (
              <div className="space-y-5">
                <HandTitle className="text-3xl">➤ 投递去向</HandTitle>
                <p className="text-xs text-[color:var(--ink)]/60 font-body">全量留存，用于检测异常操作（如反复报名/取消）</p>

                {deliveryData.map((d, idx) => (
                  <PaperCard rotate={idx % 2 === 0 ? -0.5 : 0.5} key={d.teacher} className="px-3">
                    <div className="px-5 py-3 border-b-4 border-dashed border-[color:var(--pine)]/20 flex items-center justify-between">
                      <div>
                        <HandTitle className="text-lg">{d.teacher}</HandTitle>
                        <p className="text-[10px] text-[color:var(--ink)]/50 font-body">{d.school}</p>
                      </div>
                      <span className="inline-block text-[11px] font-bold font-body bg-[color:var(--pine)] text-[color:var(--surface)] rounded-full px-3 py-1 border-2 border-[color:var(--pine)]">
                        近 7 天投递 {d.count} 次
                      </span>
                    </div>
                    <ul className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                      {d.recent.map((r) => (
                        <li key={r} className="px-5 py-2.5 text-xs text-[color:var(--ink)] flex items-center gap-2 font-body">
                          <span className="w-2 h-2 rounded-full bg-[color:var(--leaf)]" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </PaperCard>
                ))}

                {riskAlerts.length > 0 ? (
                  riskAlerts.map((a) => (
                    <PaperCard key={a.teacher} rotate={-1} className="p-3 bg-[color:var(--amber)]/15">
                      <p className="text-[11px] text-[color:var(--pine)] font-body">
                        ⚠️ 风控提示：{a.teacher} 近 7 天投递 {a.count} 次，含 {a.cancelled} 次取消，建议关注是否存在恶意占单行为
                      </p>
                    </PaperCard>
                  ))
                ) : (
                  <PaperCard rotate={-1} className="p-3 bg-[color:var(--mint)]/20">
                    <p className="text-[11px] text-[color:var(--pine)] font-body">✓ 当前暂无异常投递行为</p>
                  </PaperCard>
                )}
              </div>
            )}

            {/* 匹配记录 */}
            {active === "match" && (
              <div className="space-y-4">
                <HandTitle className="text-3xl">⇄ 匹配记录</HandTitle>
                <p className="text-xs text-[color:var(--ink)]/60 font-body">全部匹配历史，含操作留痕</p>

                <PaperCard rotate={0} className="px-3">
                  <table className="w-full">
                    <thead className="bg-[color:var(--sky)]/25">
                      <tr>
                        <Th>需求</Th>
                        <Th>老师</Th>
                        <Th>家长</Th>
                        <Th>匹配时间</Th>
                        <Th>状态</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                      {matchRecords.map((m) => (
                        <tr key={m.id}>
                          <Td className="font-extrabold text-[color:var(--pine)]">{m.id}</Td>
                          <Td>{m.teacher}</Td>
                          <Td>{m.parent}</Td>
                          <Td className="text-[color:var(--ink)]/50">{m.matchedAt}</Td>
                          <Td><StatusSticker status={m.status} /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PaperCard>
              </div>
            )}

            {/* 收费登记 */}
            {active === "fee" && (
              <div className="space-y-4">
                <HandTitle className="text-3xl">¥ 收费登记</HandTitle>
                <p className="text-xs text-[color:var(--ink)]/60 font-body">成交总课时费 8% 信息费，微信私信收取后登记</p>

                <PaperCard rotate={-0.5} className="px-3">
                  <table className="w-full">
                    <thead className="bg-[color:var(--amber)]/35">
                      <tr>
                        <Th>订单</Th>
                        <Th>老师</Th>
                        <Th>总课时费</Th>
                        <Th>信息费 8%</Th>
                        <Th>状态</Th>
                        <Th>操作</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-dashed divide-[color:var(--pine)]/10">
                      {fees.map((f) => (
                        <tr key={f.id}>
                          <Td className="font-extrabold text-[color:var(--pine)]">{f.demand}</Td>
                          <Td>{f.teacher}</Td>
                          <Td className="font-body">{f.totalFee} 元</Td>
                          <Td className="font-extrabold text-[color:var(--pine)] font-body">{f.fee8} 元</Td>
                          <Td><StatusSticker status={f.collected ? "已收" : "未收"} /></Td>
                          <Td>
                            {f.collected ? (
                              <span className="text-xs text-[color:var(--ink)]/30 font-body">已登记</span>
                            ) : (
                              <StickerBtn
                                tone="leaf"
                                onClick={() =>
                                  setFees((list) =>
                                    list.map((x) => (x.id === f.id ? { ...x, collected: true } : x)),
                                  )
                                }
                              >
                                ✓ 登记已收
                              </StickerBtn>
                            )}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PaperCard>

                {/* 收款统计 */}
                <div className="grid grid-cols-3 gap-4">
                  <PaperCard rotate={-1} className="p-4">
                    <p className="text-[11px] font-bold text-[color:var(--ink)]/60 font-body">应收总额</p>
                    <p className="text-2xl font-extrabold text-[color:var(--pine)] mt-1 font-body">
                      {fees.reduce((s, f) => s + f.fee8, 0)} 元
                    </p>
                  </PaperCard>
                  <PaperCard rotate={0.5} className="p-4">
                    <p className="text-[11px] font-bold text-[color:var(--ink)]/60 font-body">已收总额</p>
                    <p className="text-2xl font-extrabold text-[color:var(--leaf)] mt-1 font-body">
                      {fees.filter((f) => f.collected).reduce((s, f) => s + f.fee8, 0)} 元
                    </p>
                  </PaperCard>
                  <PaperCard rotate={-0.5} className="p-4">
                    <p className="text-[11px] font-bold text-[color:var(--ink)]/60 font-body">待收总额</p>
                    <p className="text-2xl font-extrabold text-[color:var(--amber)] mt-1 font-body">
                      {fees.filter((f) => !f.collected).reduce((s, f) => s + f.fee8, 0)} 元
                    </p>
                  </PaperCard>
                </div>
              </div>
            )}
              </>
            )}
          </main>

          {/* 底部纸胶带装饰 */}
          <div className="h-3 bg-[repeating-linear-gradient(90deg,var(--mint),var(--mint)_30px,var(--sky)_30px,var(--sky)_60px)]" />
        </div>
      </div>

      {/* 学籍认证审核弹窗 —— 与教师端「我的→实名+学籍认证」提交内容对齐 */}
      {previewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setPreviewTarget(null)}>
          <div
            className="relative w-full max-w-md bg-[color:var(--paper)] border-4 border-dashed border-[color:var(--pine)]/30 rounded-2xl shadow-[0_8px_0_oklch(0.321_0.029_167.6/0.2)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewTarget(null)}
              className="absolute top-3 right-4 text-2xl text-[color:var(--ink)]/40 hover:text-[color:var(--pine)] font-bold w-8 h-8 grid place-items-center rounded-full hover:bg-[color:var(--mint)]/40 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <HandTitle className="text-xl">🪪 实名 + 学籍认证</HandTitle>
            <p className="text-xs text-[color:var(--ink)]/60 font-body mt-1">
              {previewTarget.name} · {previewTarget.school}
            </p>
            <p className="text-[10px] text-[color:var(--ink)]/40 font-body mt-0.5">
              提交于 {previewTarget.submittedAt}
            </p>

            {/* 与教师端一致：学生证 + 学信网截图 */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="aspect-4/3 rounded-xl border-2 border-[color:var(--pine)]/20 bg-white grid place-items-center cursor-pointer hover:border-[color:var(--pine)]/50 hover:shadow-[0_3px_0_oklch(0.321_0.029_167.6/0.15)] transition-all overflow-hidden">
                {previewTarget.studentCard ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-4xl">🪪</span>
                    <span className="text-[10px] font-bold text-[color:var(--pine)] truncate max-w-full px-2">{previewTarget.studentCard}</span>
                    <span className="text-[9px] text-[color:var(--ink)]/40">点击查看大图</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-[color:var(--ink)]/30">未提交</span>
                )}
              </div>
              <div className="aspect-4/3 rounded-xl border-2 border-[color:var(--pine)]/20 bg-white grid place-items-center cursor-pointer hover:border-[color:var(--pine)]/50 hover:shadow-[0_3px_0_oklch(0.321_0.029_167.6/0.15)] transition-all overflow-hidden">
                {previewTarget.chsiScreenshot ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-4xl">🌐</span>
                    <span className="text-[10px] font-bold text-[color:var(--pine)] truncate max-w-full px-2">{previewTarget.chsiScreenshot}</span>
                    <span className="text-[9px] text-[color:var(--ink)]/40">点击查看大图</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-[color:var(--ink)]/30">未提交</span>
                )}
              </div>
            </div>

            {/* 授权展示学校 */}
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs font-bold font-body">授权在简历中展示学校名称</span>
              <span className={`text-xs font-extrabold font-body ${previewTarget.showSchool ? "text-[color:var(--leaf)]" : "text-[color:var(--ink)]/30"}`}>
                {previewTarget.showSchool ? "✓ 已授权" : "✗ 未授权"}
              </span>
            </div>

            {/* 审核状态 + 操作 */}
            <div className="mt-5 pt-4 border-t-2 border-dashed border-[color:var(--pine)]/15">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-body text-[color:var(--ink)]/60">当前状态</span>
                <StatusSticker status={previewTarget.status} />
              </div>
              {previewTarget.status === "待审核" && (
                <div className="flex gap-2 mt-3 justify-end">
                  <StickerBtn
                    tone="leaf"
                    onClick={() => {
                      setVerify((list) => list.map((x) => (x.id === previewTarget.id ? { ...x, status: "已通过" } : x)));
                      setPreviewTarget((t) => t ? { ...t, status: "已通过" } : null);
                    }}
                  >
                    ✓ 通过
                  </StickerBtn>
                  <StickerBtn
                    tone="ghost"
                    onClick={() => {
                      setVerify((list) => list.map((x) => (x.id === previewTarget.id ? { ...x, status: "已驳回" } : x)));
                      setPreviewTarget((t) => t ? { ...t, status: "已驳回" } : null);
                    }}
                  >
                    ✗ 驳回
                  </StickerBtn>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
