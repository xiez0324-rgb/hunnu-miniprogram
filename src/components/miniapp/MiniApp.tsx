import { useEffect, useRef, useState } from "react";
import appIcon from "@/assets/app-icon.png";
import tutor1 from "@/assets/tutor-1.jpg";
import tutor2 from "@/assets/tutor-2.jpg";
import {
  demands,
  myApplies,
  teachers,
  applicantsByDemand,
  allSubjects,
  districts,
  feeTip,
  type Demand,
  type Applicant,
  type Teacher,
} from "./data";
import AdminPanel, { type SharedOrder } from "../admin/AdminPanel";
import {
  Chip,
  ConfirmDialog,
  DropdownPanel,
  Field,
  FilterOption,
  GhostButton,
  ListItem,
  NavBar,
  PrimaryButton,
  RiskNote,
  Row,
  SelectField,
  StatusTag,
  TextInput,
  TornCard,
  VerifyTag,
} from "./ui";

// 老师身份行文案：平台合作院校固定为湖南师范大学，前端不展示学校名，只展示「学院 · 专业」。
// 兼容旧 mock 数据「中南大学 · 数学系」这类校名+院系混写串：去掉首段校名仅保留后半段。
function collegeMajorText(p?: { college?: string; major?: string; school?: string }): string {
  const college = (p?.college || "").trim();
  const major = (p?.major || "").trim();
  if (college || major) return [college, major].filter(Boolean).join(" · ");
  const school = (p?.school || "").trim();
  if (!school || school === "在读大学生") return "";
  const parts = school.split("·").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" · ") : "";
}

type Screen =
  | "login"
  | "role"
  | "privacy"
  | "plaza"
  | "demandDetail"
  | "applySuccess"
  | "applies"
  | "teacherMe"
  | "resume"
  | "verify"
  | "publish"
  | "publishSuccess"
  | "myDemands"
  | "parentDemandDetail"
  | "parentMe"
  | "parentContact"
  | "teacherList"
  | "notifications"
  | "teacherContact"
  | "teacherResume";

const avatars = [tutor1, tutor2];

/** 原型中假定“王女士”自己发布的需求：仅广场数据中的前两条 */
const parentDemands = demands.slice(0, 2);

/** 我的报名：静态种子数据 + 运行中动态报名（父级受控，保证与需求广场联动） */
type ApplyItem = (typeof myApplies)[number];

export default function MiniApp() {
  const [mode, setMode] = useState<"mini" | "admin">("mini");
  const [screen, setScreen] = useState<Screen>("login");
  const [role, setRole] = useState<"parent" | "teacher">("teacher");
  const [current, setCurrent] = useState<Demand>(demands[0]!);
  const [applyList, setApplyList] = useState<ApplyItem[]>(myApplies);
  const [applyFilter, setApplyFilter] = useState("全部");
  const [confirmedTeacher, setConfirmedTeacher] = useState<Record<string, string>>({});
  /** 家长"想进一步了解/试课"的意向：demandId → 老师名单（可与已确认主选并存） */
  const [interestedTeachers, setInterestedTeachers] = useState<Record<string, string[]>>({});
  const [sharedOrders, setSharedOrders] = useState<SharedOrder[]>([]);
  const [teacherUnread, setTeacherUnread] = useState(3);
  const [parentUnread, setParentUnread] = useState(3);
  const [resumeTeacher, setResumeTeacher] = useState<Teacher | null>(null);

  const go = (s: Screen) => setScreen(s);

  /** 报名中（占名额）：已报名 / 已推荐 / 已确认；已成交/已取消不占 */
  const activeApplies = applyList.filter(
    (a) => a.status === "已报名" || a.status === "已推荐" || a.status === "已确认",
  );
  /** 该需求单当前老师是否已参与过（含已成交历史），参与过则不可重复报名 */
  const hasAppliedDemand = (demandId: string) =>
    applyList.some((a) => a.demandId === demandId && a.status !== "已取消");
  const APPLY_LIMIT = 5;

  const openResume = (t: Teacher) => {
    setResumeTeacher(t);
    go("teacherResume");
  };

  /** 报名动作：去重 + 限报 5 个校验 + 写入「我的报名」 */
  const handleApply = (d: Demand) => {
    if (hasAppliedDemand(d.id)) return; // 已参与过该单（含历史成交）
    if (activeApplies.length >= APPLY_LIMIT) return; // 已达上限（按钮层已禁用）
    setApplyList((prev) => [
      ...prev,
      {
        id: `apply-${Date.now()}`,
        demandId: d.id,
        title: `${d.grade} · ${d.subject}`,
        budget: d.budget,
        meta: d.area,
        status: "已报名",
      },
    ]);
    go("applySuccess");
  };

  /** 取消报名（由「我的报名」触发，标记状态流转） */
  const handleCancelApply = (id: string) => {
    setApplyList((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "已取消" as const } : a)),
    );
  };

  /** 家长在确认主选老师后，仍可对其他老师表达"想进一步了解/试课"（去重记录） */
  const handleInterestTeacher = (demandId: string, teacher: string) => {
    setInterestedTeachers((prev) => {
      const cur = prev[demandId] ?? [];
      if (cur.includes(teacher)) return prev;
      return { ...prev, [demandId]: [...cur, teacher] };
    });
  };

  const handleConfirmTeacher = (demandId: string, teacher: string) => {
    setConfirmedTeacher((prev) => ({ ...prev, [demandId]: teacher }));
    setSharedOrders((prev) =>
      prev.some((o) => o.demandId === demandId)
        ? prev
        : [
            ...prev,
            {
              id: `so-${demandId}`,
              demandId,
              teacher,
              parent: "王女士",
              parentPhone: "138-6688-1201",
              teacherPhone: "—",
              status: "待联系",
            },
          ],
    );
  };

  const teacherTabs: { key: Screen; label: string; icon: string }[] = [
    { key: "plaza", label: "需求广场", icon: "🏫" },
    { key: "applies", label: "我的报名", icon: "📋" },
    { key: "teacherMe", label: "我的", icon: "👤" },
  ];
  const parentTabs: { key: Screen; label: string; icon: string }[] = [
    { key: "publish", label: "发布需求", icon: "✏️" },
    { key: "myDemands", label: "我的需求", icon: "📌" },
    { key: "parentMe", label: "我的", icon: "👤" },
  ];
  const tabs = role === "teacher" ? teacherTabs : parentTabs;
  const showTabs = tabs.some((t) => t.key === screen);

  // 角标语义：当前家长「待确认人选」的需求条数（有平台推荐、且尚未确认的老师，确认后自动消失）
  const pendingConfirmCount = parentDemands.filter(
    (d) => d.recommended > 0 && !confirmedTeacher[d.id],
  ).length;

  return (
    <div className="min-h-screen bg-paper">
      <button
        onClick={() => setMode((m) => (m === "mini" ? "admin" : "mini"))}
        className="fixed bottom-4 right-4 z-50 text-[11px] font-extrabold px-2.5 py-1.5 rounded-full bg-ink text-paper shadow-lg hover:opacity-85 transition-opacity"
      >
        {mode === "mini" ? "管理员后台 →" : "← 小程序预览"}
      </button>

      {mode === "admin" ? (
        <AdminPanel
          externalOrders={sharedOrders}
          onOrderStatusChange={(id, status) =>
            setSharedOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
          }
          parentInterests={Object.entries(interestedTeachers).flatMap(([demandId, teachers]) =>
            teachers.map((teacher) => ({ demandId, teacher, parent: "王女士" })),
          )}
        />
      ) : (
        <div className="w-[390px] min-h-screen bg-paper text-ink font-body relative overflow-visible px-4 pt-5 pb-28 select-none mx-auto">
          {/* 装饰剪纸仅在隐私页以外的界面显示，避免遮挡隐私页顶部标题 */}
          {screen !== "privacy" && (
            <>
              <div className="pointer-events-none absolute top-24 -left-3 size-6 bg-mint/60 rounded-[40%_60%_55%_45%] rotate-12" />
              <div className="pointer-events-none absolute top-[150px] right-0 size-4 bg-sky/60 rounded-[55%_45%_60%_40%] -rotate-6" />
              <div className="pointer-events-none absolute top-[560px] left-1 size-5 bg-amber/50 rounded-[45%_55%_40%_60%] rotate-45" />
            </>
          )}

          {screen === "login" && <Login onNext={() => go("role")} onPrivacy={() => go("privacy")} />}

          {screen === "role" && (
            <RoleSelect
              onPick={(r) => {
                setRole(r);
                go(r === "teacher" ? "plaza" : "publish");
              }}
            />
          )}

          {screen === "privacy" && <Privacy onBack={() => go(role === "teacher" ? "teacherMe" : "parentMe")} />}

          {screen === "plaza" && (
            <Plaza
              onOpen={(d) => {
                setCurrent(d);
                go("demandDetail");
              }}
              stats={{
                active: activeApplies.length,
                applied: applyList.filter((a) => a.status === "已报名").length,
                recommended: applyList.filter((a) => a.status === "已推荐").length,
                done: applyList.filter((a) => a.status === "已成交").length,
              }}
            />
          )}

          {screen === "demandDetail" && (
            <DemandDetail
              demand={current}
              applied={hasAppliedDemand(current.id)}
              appliedStatus={
                applyList.find((a) => a.demandId === current.id && a.status !== "已取消")?.status
              }
              limitFull={activeApplies.length >= APPLY_LIMIT}
              activeCount={activeApplies.length}
              limit={APPLY_LIMIT}
              onBack={() => go("plaza")}
              onApply={() => handleApply(current)}
            />
          )}

          {screen === "applySuccess" && (
            <SuccessScreen
              title="报名成功！"
              desc="代理人会尽快核验并推荐给家长，请保持通知开启"
              primary="开启通知（订阅）"
              secondary="查看我的报名"
              onSecondary={() => go("applies")}
            />
          )}

          {screen === "applies" && (
            <Applies
              list={applyList}
              filter={applyFilter}
              setFilter={setApplyFilter}
              onCancel={handleCancelApply}
            />
          )}

          {screen === "teacherMe" && (
            <TeacherMe
              onGo={go}
              unread={teacherUnread}
              onSwitch={() => {
                setRole("parent");
                go("role");
              }}
            />
          )}

          {screen === "resume" && <Resume onBack={() => go("teacherMe")} />}
          {screen === "verify" && <Verify onBack={() => go("teacherMe")} />}
          {screen === "teacherContact" && <TeacherContact onBack={() => go("teacherMe")} />}
          {screen === "notifications" && (
            <Notifications
              onBack={() => go(role === "parent" ? "parentMe" : "teacherMe")}
              variant={role === "parent" ? "parent" : "teacher"}
              onUnreadChange={(n) =>
                role === "parent" ? setParentUnread(n) : setTeacherUnread(n)
              }
            />
          )}

          {screen === "publish" && <Publish onSubmit={() => go("publishSuccess")} />}

          {screen === "publishSuccess" && (
            <SuccessScreen
              title="需求发布成功！"
              desc="需求已上架，符合条件的老师会陆续报名"
              primary="开启通知（订阅）"
              secondary="查看我的需求"
              onSecondary={() => go("myDemands")}
            />
          )}

          {screen === "myDemands" && (
            <MyDemands
              onOpen={(d) => {
                setCurrent(d);
                go("parentDemandDetail");
              }}
              confirmedTeacher={confirmedTeacher}
              orders={sharedOrders}
            />
          )}

          {screen === "parentDemandDetail" && (
            <ParentDemandDetail
              demand={current}
              onBack={() => go("myDemands")}
              confirmedTeacher={confirmedTeacher}
              onConfirmTeacher={handleConfirmTeacher}
              onInterestTeacher={handleInterestTeacher}
              interestedTeachers={interestedTeachers[current.id] ?? []}
              onViewResume={openResume}
            />
          )}

          {screen === "teacherResume" && resumeTeacher && (
            <TeacherResume teacher={resumeTeacher} onBack={() => go("parentDemandDetail")} />
          )}

          {screen === "parentMe" && (
            <ParentMe
              onGo={go}
              unread={parentUnread}
              onSwitch={() => {
                setRole("teacher");
                go("role");
              }}
            />
          )}

          {screen === "teacherList" && <TeacherList onBack={() => go("parentMe")} />}

          {screen === "parentContact" && <ParentContact onBack={() => go("parentMe")} />}

          {showTabs && (
            <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[390px] px-4 pb-4">
              <div className="torn-b bg-ink text-paper rounded-2xl px-3 py-2.5 flex items-center justify-between shadow-[0_-4px_0_rgba(36,56,48,0.15)]">
                {tabs.map((t) => {
                  const showBadge = t.key === "myDemands" && pendingConfirmCount > 0;
                  return (
                    <button
                      key={t.key}
                      onClick={() => go(t.key)}
                      className={`flex flex-col items-center gap-0.5 flex-1 ${
                        screen === t.key ? "" : "opacity-50"
                      }`}
                    >
                      <span className="relative text-lg leading-none">
                        {t.icon}
                        {showBadge && (
                          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold grid place-items-center border-2 border-ink">
                            {pendingConfirmCount > 99 ? "99+" : pendingConfirmCount}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${screen === t.key ? "text-mint" : ""}`}
                      >
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}

function Header({ sub, title }: { sub: string; title: string }) {
  return (
    <header className="flex items-center justify-between mb-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-leaf">{sub}</p>
        <h1 className="text-2xl font-extrabold leading-none">{title}</h1>
      </div>
      <img
        src={appIcon}
        alt="小小陪伴帮"
        width={512}
        height={512}
        loading="lazy"
        className="size-11 rounded-full bg-mint/30 outline-1 -outline-offset-1 outline-ink/10 object-contain"
      />
    </header>
  );
}

function Login({ onNext, onPrivacy }: { onNext: () => void; onPrivacy: () => void }) {
  return (
    <div className="pt-16 text-center">
      <img
        src={appIcon}
        alt="小小陪伴帮"
        width={512}
        height={512}
        className="size-28 mx-auto rounded-full"
      />
      <h1 className="text-2xl font-extrabold mt-4">小小陪伴帮</h1>

      <TornCard className="mt-10 text-left" tilt="rotate-[0.7deg]">
        <PrimaryButton onClick={onNext}>微信一键登录</PrimaryButton>
        <p className="text-[11px] text-ink/50 mt-3 text-center leading-relaxed">
          登录即代表同意《用户协议》与
          <button onClick={onPrivacy} className="text-leaf font-bold underline">
            《隐私与风险说明》
          </button>
        </p>
      </TornCard>
    </div>
  );
}

function RoleSelect({ onPick }: { onPick: (r: "parent" | "teacher") => void }) {
  return (
    <div className="pt-14">
      <h1 className="text-2xl font-extrabold text-center">你是？</h1>
      <p className="text-xs text-ink/55 text-center mt-1">后续可在「我的」页切换身份</p>
      <div className="grid grid-cols-2 gap-3 mt-8">
        <button onClick={() => onPick("parent")} className="text-left">
          <TornCard tilt="rotate-[-1deg]">
            <span className="text-3xl">🏠</span>
            <p className="text-base font-extrabold mt-2">我是家长</p>
            <p className="text-xs text-ink/50 mt-0.5">找家教</p>
          </TornCard>
        </button>
        <button onClick={() => onPick("teacher")} className="text-left">
          <TornCard tilt="rotate-[1deg]">
            <span className="text-3xl">🎓</span>
            <p className="text-base font-extrabold mt-2">我是老师</p>
            <p className="text-xs text-ink/50 mt-0.5">来接单</p>
          </TornCard>
        </button>
      </div>
    </div>
  );
}

function Privacy({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <NavBar title="隐私与风险说明" onBack={onBack} />
      <TornCard>
        <p className="text-xs font-extrabold text-pine mb-2 mt-12">📄 用户信息采集与隐私保护声明</p>
        <div className="text-[11px] leading-relaxed text-ink/65 space-y-3">
          <PrivacyPolicyBody />
        </div>
      </TornCard>
    </div>
  );
}

/** 声明的正文条款（无外层容器），供独立隐私页与可滚动卡片复用 */
function PrivacyPolicyBody() {
  return (
    <>
      <p>
        欢迎使用「小小陪伴帮」。我们深知个人信息对您的重要性，并将依照相关法律法规，采取合理的安全保护措施，尽力保障您的个人信息安全可控。本声明旨在向您说明我们如何收集、使用、存储与保护您的个人信息，以及您享有的相应权利。请您在提交任何信息前，仔细阅读并充分理解本声明全部内容。
      </p>

      <div>
        <p className="font-extrabold text-ink/80">一、信息收集范围</p>
        <p className="mt-1">
          1.1 老师端：为完成身份核验与信息展示，我们会收集您的姓名、学院、专业、可授课科目与时段、期望时薪、可服务区域、自我介绍，以及用于学籍/学历证明的学生证、学信网截图等证明材料。
        </p>
        <p className="mt-1">
          1.2 家长端：为完成需求发布与对接，我们会收集您的称呼、联系电话、上课地址（可能精确至小区及楼栋）及需求描述等信息。
        </p>
        <p className="mt-1">
          1.3 我们仅收集您主动填写或上传、且与提供服务相关的必要信息，不超出上述范围收集与服务无关的信息。
        </p>
      </div>

      <div>
        <p className="font-extrabold text-ink/80">二、信息使用目的</p>
        <p className="mt-1">
          2.1 学籍/学历证明材料仅用于对老师身份与资质的核验，并在获得您明确授权后，以「已认证」标签等形式在平台范围内展示。
        </p>
        <p className="mt-1">
          2.2 联系方式（电话、微信号等）仅用于平台代理人与您对接沟通，不会在需求广场等公开页面展示。
        </p>
        <p className="mt-1">
          2.3 家长住址信息仅用于匹配老师判断通勤距离及线下授课安排，不会向无关第三方披露。
        </p>
      </div>

      <div>
        <p className="font-extrabold text-ink/80">三、授权展示与撤回</p>
        <p className="mt-1">
          涉及学籍、学历等身份信息的公开展示，须经您明确授权。您可随时在个人中心撤回授权，撤回后我们将停止相关展示。
        </p>
      </div>

      <div>
        <p className="font-extrabold text-ink/80">四、信息撮合免责声明</p>
        <p className="mt-1">
          4.1 本平台仅提供家教信息撮合服务，不提供教学服务、不代收课时费。老师与家长的授课安排、费用结算等均由双方线下自行商定。
        </p>
        <p className="mt-1">
          4.2 双方在对接过程中应自行核实与本次授课相关的资质、能力及其他必要信息。因双方线下交易产生的争议与纠纷，平台在法律允许范围内不承担责任。
        </p>
      </div>

      <div>
        <p className="font-extrabold text-ink/80">五、家长信息准确性</p>
        <p className="mt-1">
          家长应确保所填写的联系电话、上课地址等信息真实、准确、完整。因家长误填、漏填或提供虚假信息导致的无法对接、延误或相关纠纷，由家长自行承担，平台在法律允许范围内不承担责任。
        </p>
      </div>

      <div>
        <p className="font-extrabold text-ink/80">六、学生信息验证责任</p>
        <p className="mt-1">
          6.1 平台对学生/老师提交的学籍、学历等身份信息承担主要核实责任，并通过人工核验等方式进行审查。
        </p>
        <p className="mt-1">
          6.2 因平台核实疏忽，致使不实学籍/学历信息被展示并给他人造成损失的，平台将在过错范围内承担相应责任，并积极跟进处理。
        </p>
      </div>

      <div>
        <p className="font-extrabold text-ink/80">七、信息安全与保密</p>
        <p className="mt-1">
          我们采取合理的技术与管理措施保护您的个人信息，防止未经授权的访问、泄露、篡改或丢失。除法律法规规定或经您授权同意外，我们不会向无关第三方提供您的个人信息。
        </p>
      </div>

      <div>
        <p className="font-extrabold text-ink/80">八、其他</p>
        <p className="mt-1">
          8.1 如对本声明或个人信息保护有任何疑问、意见或投诉，请联系平台代理人 Kiki。
        </p>
        <p className="mt-1">
          8.2 我们可能根据法律法规或业务调整适时更新本声明，更新后将在平台内公示。
        </p>
      </div>
    </>
  );
}

/** 可滚动阅读的《用户信息采集与隐私保护声明》，家长发布页 / 老师简历页底部复用 */
function PrivacyPolicyScroll() {
  return (
    <TornCard tilt="rotate-[0.4deg]" className="mt-4">
      <p className="text-xs font-extrabold text-pine mb-2">📄 用户信息采集与隐私保护声明</p>
      <div className="max-h-72 overflow-y-auto pr-1.5 text-[11px] leading-relaxed text-ink/65 space-y-3">
        <PrivacyPolicyBody />
      </div>
    </TornCard>
  );
}

function Plaza({
  onOpen,
  stats,
}: {
  onOpen: (d: Demand) => void;
  stats: { active: number; applied: number; recommended: number; done: number };
}) {
  const [subject, setSubject] = useState("全部");
  const [grade, setGrade] = useState("不限");
  const [gender, setGender] = useState("不限");
  const [area, setArea] = useState("不限");
  const [sort, setSort] = useState("综合排序");
  const [openFilter, setOpenFilter] = useState<null | "subject" | "grade" | "gender" | "area" | "sort">(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const [maskEdges, setMaskEdges] = useState<{ left: boolean; right: boolean }>({ left: false, right: true });
  const filterBarRef = useRef<HTMLDivElement>(null);

  // 监听筛选栏滚动位置，动态决定哪侧显示渐隐
  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const onScroll = () => {
      const atLeft = el.scrollLeft <= 1;
      const atRight = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      setMaskEdges({ left: !atLeft, right: !atRight });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const maskImage =
    maskEdges.left && maskEdges.right
      ? "[mask-image:linear-gradient(to_right,transparent_0,black_14px,black_calc(100%-14px),transparent_100%)]"
      : maskEdges.left
      ? "[mask-image:linear-gradient(to_right,transparent_0,black_14px,black_100%)]"
      : maskEdges.right
      ? "[mask-image:linear-gradient(to_right,black_0,black_calc(100%-14px),transparent_100%)]"
      : "";

  // 展开时动态计算筛选栏位置和宽度，让面板完全对齐
  useEffect(() => {
    if (openFilter && filterBarRef.current) {
      const rect = filterBarRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.bottom, left: rect.left, width: rect.width });
    }
  }, [openFilter]);

  // 点击外部收起下拉面板
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-plaza-panel]")) {
        setOpenFilter(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openFilter]);

  const subjectOptions = ["全部", ...allSubjects, "其他"];
  const gradeOptions = ["不限", "小学", "初中", "高中"];
  const genderOptions = ["不限", "男", "女"];
  const areaOptions = ["不限", ...districts, "线上", "其他"];
  const sortOptions = ["综合排序", "距离排序", "报价排序"];

  const filterTabs: { key: typeof openFilter; label: string; value: string; options: string[]; defaultValue: string; state: string; setState: (v: string) => void }[] = [
    { key: "sort", label: "排序", value: sort, options: sortOptions, defaultValue: "综合排序", state: sort, setState: setSort },
    { key: "subject", label: "科目", value: subject, options: subjectOptions, defaultValue: "全部", state: subject, setState: setSubject },
    { key: "grade", label: "年级", value: grade, options: gradeOptions, defaultValue: "不限", state: grade, setState: setGrade },
    { key: "area", label: "区域", value: area, options: areaOptions, defaultValue: "不限", state: area, setState: setArea },
    { key: "gender", label: "老师性别", value: gender, options: genderOptions, defaultValue: "不限", state: gender, setState: setGender },
  ];

  const currentTab = filterTabs.find((t) => t.key === openFilter);

  const filtered = demands.filter((d) => {
    if (subject !== "全部") {
      if (subject === "其他") {
        if (allSubjects.includes(d.subject)) return false;
      } else if (d.subject !== subject) return false;
    }
    if (grade !== "不限" && !d.grade.includes(grade)) return false;
    if (area !== "不限" && !d.area.includes(area)) return false;
    if (gender !== "不限" && d.gender !== gender) return false;
    return true;
  });

  // 排序：综合排序优先非K12；报价排序按平均价升序；距离排序暂用区域名 fallback
  function parseBudgetAvg(budget: string): number {
    const nums = budget.match(/\d+/g)?.map(Number) ?? [];
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  const list = [...filtered].sort((a, b) => {
    if (sort === "报价排序") {
      return parseBudgetAvg(a.budget) - parseBudgetAvg(b.budget);
    }
    if (sort === "距离排序") {
      // 暂用区域名字典序 fallback
      return a.area.localeCompare(b.area, "zh-CN");
    }
    // 综合排序：非 K12（体育/艺术/编程）优先排前面
    const aIsK12 = a.category === "主科";
    const bIsK12 = b.category === "主科";
    if (aIsK12 !== bIsK12) return aIsK12 ? 1 : -1;
    // 同类内按报名数多的靠前
    return b.applicants - a.applicants;
  });

  return (
    <div>
      <Header sub="老师端 · 接单" title="需求广场" />

      <TornCard tilt="rotate-[-0.6deg]" className="mb-5 p-5">
        <p className="font-hand text-3xl leading-none text-pine">您好，张同学</p>
        <p className="text-xs text-ink/55 mt-1">
          今日新增 <span className="font-extrabold text-leaf">6</span> 条需求，报名中 {stats.active} / 5
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="bg-mint/25 rounded-xl py-2">
            <p className="text-lg font-extrabold leading-none">{stats.applied}</p>
            <p className="text-[10px] text-ink/50 mt-0.5">已报名</p>
          </div>
          <div className="bg-sky/25 rounded-xl py-2">
            <p className="text-lg font-extrabold leading-none">{stats.recommended}</p>
            <p className="text-[10px] text-ink/50 mt-0.5">已推荐</p>
          </div>
          <div className="bg-amber/25 rounded-xl py-2">
            <p className="text-lg font-extrabold leading-none">{stats.done}</p>
            <p className="text-[10px] text-ink/50 mt-0.5">已成交</p>
          </div>
        </div>
      </TornCard>

      {/* 闲鱼风格筛选 Tab：底部无边框、纯白背景与面板统一、可横向滑动、右侧渐隐提示 */}
      <div ref={filterBarRef} data-plaza-panel className={`flex items-center gap-1 bg-white border-t border-l border-r border-gray-200 pl-1 py-1 overflow-x-auto no-scrollbar ${maskImage}`}>
        {filterTabs.map((t) => {
          const isActive = t.value !== t.defaultValue;
          const isOpen = openFilter === t.key;
          return (
            <button
              key={t.label}
              onClick={() => setOpenFilter(isOpen ? null : t.key)}
              className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                isOpen
                  ? "bg-emerald-500 text-white"
                  : isActive
                  ? "text-emerald-600"
                  : "text-gray-500"
              }`}
            >
              <span>
                {isActive ? t.value : t.label}
                <span className={`ml-0.5 text-[10px] ${isOpen ? "rotate-180 inline-block transition-transform" : ""}`}>
                  ▾
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
      {list.length === 0 ? (
        <TornCard className="text-center py-8">
          <p className="text-3xl">🍃</p>
          <p className="text-sm font-bold mt-2">暂时没有匹配的需求</p>
          <p className="text-xs text-ink/50 mt-1">换个筛选条件看看吧</p>
        </TornCard>
      ) : (
        list.map((d, i) => (
          <button key={d.id} onClick={() => onOpen(d)} className="block w-full text-left">
            <TornCard className="mb-4" tilt={i % 2 ? "rotate-[-0.8deg]" : "rotate-[0.7deg]"}>
              <div className="flex items-start gap-3">
                <div className="size-14 shrink-0 rounded-2xl bg-mint/30 grid place-items-center font-extrabold text-pine text-sm">
                  {d.subject}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-base font-extrabold">
                      {d.grade} · {d.subject}
                    </h3>
                    <StatusTag status={d.status} />
                  </div>
                  <p className="text-xs text-ink/55 mt-0.5">
                    {d.title} · {d.time}
                  </p>
                  <p className="text-xs text-ink/55 mt-0.5">
                    {d.area} · {d.gender === "不限" ? "性别不限" : `偏好${d.gender}老师`}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-extrabold text-leaf">{d.budget}</span>
                    <span className="text-[11px] text-ink/45">
                      已有 {d.applicants} 位老师报名
                    </span>
                  </div>
                </div>
              </div>
            </TornCard>
          </button>
        ))
      )}
      </div>

      {/* 从筛选栏正下方无缝展开的下拉面板 */}
      <DropdownPanel
        data-plaza-panel
        visible={openFilter !== null}
        onClose={() => setOpenFilter(null)}
        title={currentTab ? currentTab.label : ""}
        top={panelPos.top}
        left={panelPos.left}
        width={panelPos.width}
      >
        {currentTab && currentTab.options.map((opt) => (
          <FilterOption
            key={opt}
            label={opt}
            selected={currentTab.state === opt}
            onClick={() => {
              currentTab.setState(opt);
              setOpenFilter(null);
            }}
          />
        ))}
      </DropdownPanel>
    </div>
  );
}

function DemandDetail({
  demand,
  applied,
  appliedStatus,
  limitFull,
  activeCount,
  limit,
  onBack,
  onApply,
}: {
  demand: Demand;
  applied: boolean;
  appliedStatus?: string;
  limitFull: boolean;
  activeCount: number;
  limit: number;
  onBack: () => void;
  onApply: () => void;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <div>
      <NavBar title="需求详情" onBack={onBack} />
      <TornCard tilt="rotate-[0.5deg]">
        <div className="flex items-center gap-2">
          <VerifyTag verified />
          <span className="text-xs font-bold text-ink/50">需求单 #{demand.id}</span>
        </div>
        <div className="mt-3">
          <Row label="年级/科目" value={`${demand.grade} · ${demand.subject}`} />
          <Row label="辅导目标" value={demand.goal} />
          <Row label="授课时段" value={demand.time} />
          <Row label="预算" value={demand.budget} />
          <Row label="偏好老师" value={demand.gender === "不限" ? "不限" : `${demand.gender}老师`} />
          <Row label="区域" value={demand.area} />
          <Row label="备注" value={demand.note} />
        </div>
      </TornCard>

      <TornCard className="mt-4" tilt="rotate-[-0.8deg]">
        <p className="text-xs font-extrabold text-pine">温馨提示</p>
        <p className="text-[11px] text-ink/60 leading-relaxed mt-1">{feeTip}</p>
      </TornCard>

      <div className="mt-5">
        <PrimaryButton onClick={() => setAsking(true)} disabled={applied || limitFull}>
          {applied
            ? appliedStatus === "已成交"
              ? "该单已成交"
              : appliedStatus === "已确认"
              ? "已确认，等待对接"
              : "已报名"
            : limitFull
            ? "报名已达上限"
            : "立即报名"}
        </PrimaryButton>
        <p className="text-[11px] text-ink/45 text-center mt-2">
          报名中的需求 {activeCount} / {limit}
        </p>
      </div>
      <ConfirmDialog
        open={asking}
        title="确认报名？"
        message={`确认报名「${demand.grade} · ${demand.subject}」需求单？报名后代理人将核验并推荐给家长。`}
        confirmText="确认报名"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onApply();
        }}
      />
    </div>
  );
}

function SuccessScreen({
  title,
  desc,
  primary,
  secondary,
  onSecondary,
}: {
  title: string;
  desc: string;
  primary: string;
  secondary: string;
  onSecondary: () => void;
}) {
  const [subscribed, setSubscribed] = useState(false);
  return (
    <div className="pt-20 text-center">
      <p className="text-5xl">✅</p>
      <h1 className="text-2xl font-extrabold mt-4">{title}</h1>
      <p className="text-xs text-ink/55 mt-2 px-8 leading-relaxed">{desc}</p>
      <TornCard className="mt-8 text-left" tilt="rotate-[-0.7deg]">
        <PrimaryButton onClick={() => setSubscribed(true)} disabled={subscribed}>
          {subscribed ? "通知已开启" : primary}
        </PrimaryButton>
        <div className="mt-3">
          <GhostButton onClick={onSecondary}>{secondary}</GhostButton>
        </div>
      </TornCard>
    </div>
  );
}

function Applies({
  list,
  filter,
  setFilter,
  onCancel,
}: {
  list: ApplyItem[];
  filter: string;
  setFilter: (v: string) => void;
  onCancel: (id: string) => void;
}) {
  const chips = ["全部", "已报名", "已推荐", "已确认", "已成交"];
  const [pendingCancel, setPendingCancel] = useState<string | null>(null);
  const filtered = filter === "全部" ? list : list.filter((a) => a.status === filter);
  return (
    <div>
      <Header sub="老师端 · 进度" title="我的报名" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 mb-4">
        {chips.map((c, i) => (
          <Chip
            key={c}
            active={filter === c}
            tilt={i % 2 ? "rotate-1" : "-rotate-1"}
            onClick={() => setFilter(c)}
          >
            {c}
          </Chip>
        ))}
      </div>
      {filtered.length === 0 ? (
        <TornCard className="text-center py-8">
          <p className="text-3xl">📭</p>
          <p className="text-sm font-bold mt-2">还没有该状态的报名</p>
        </TornCard>
      ) : (
        filtered.map((a, i) => {
          const cancellable = a.status === "已报名" || a.status === "已推荐";
          return (
            <TornCard key={a.id} className="mb-4" tilt={i % 2 ? "rotate-[-0.8deg]" : "rotate-[0.7deg]"}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base font-extrabold">{a.title}</h3>
                <StatusTag status={a.status} />
              </div>
              <p className="text-xs text-ink/55 mt-0.5">
                {a.budget} · {a.meta}
              </p>
              {cancellable ? (
                <div className="mt-3">
                  <GhostButton onClick={() => setPendingCancel(a.id)}>取消报名</GhostButton>
                </div>
              ) : null}
            </TornCard>
          );
        })
      )}
      <TornCard className="mt-2" tilt="rotate-[0.4deg]">
        <p className="text-[11px] text-ink/50 leading-relaxed">
          每次报名与取消的完整记录（时间、需求、去向）都会留存后台，供平台检测异常操作；请勿频繁取消，以免被判定为恶意占单。同时报名中的需求不超过 5 个，达到上限后将无法继续报名。
        </p>
      </TornCard>
      <ConfirmDialog
        open={pendingCancel !== null}
        title="确认取消报名？"
        message="取消后将退出该需求单的报名，此操作会被后台留痕记录。确定要取消吗？"
        confirmText="确认取消"
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => {
          if (pendingCancel) onCancel(pendingCancel);
          setPendingCancel(null);
        }}
      />
    </div>
  );
}

function ProfileHead({
  name,
  desc,
  avatar,
  verified,
}: {
  name: string;
  desc: string;
  avatar: string;
  verified?: boolean;
}) {
  return (
    <TornCard className="mb-4" tilt="rotate-[-0.6deg]">
      <div className="flex items-center gap-3">
        <img
          src={avatar}
          alt={`${name}的头像`}
          width={512}
          height={512}
          loading="lazy"
          className="size-14 rounded-2xl object-cover"
        />
        <div>
          <p className="text-lg font-extrabold leading-none">{name}</p>
          <p className="text-xs text-ink/50 mt-1">{desc}</p>
          {verified !== undefined ? (
            <div className="mt-1.5">
              <VerifyTag verified={verified} />
            </div>
          ) : null}
        </div>
      </div>
    </TornCard>
  );
}

function TeacherMe({ onGo, onSwitch, unread }: { onGo: (s: Screen) => void; onSwitch: () => void; unread: number }) {
  return (
    <div>
      <Header sub="老师端 · 个人中心" title="我的" />
      <ProfileHead name="张同学" desc="大学生家教 · 在读大三" avatar={tutor1} verified={false} />
      <TornCard tilt="rotate-[0.6deg]">
        <ListItem label="简历管理" onClick={() => onGo("resume")} />
        <ListItem label="实名 + 学籍认证" hint="去认证" onClick={() => onGo("verify")} />
        <ListItem label="我的联系方式" onClick={() => onGo("teacherContact")} />
        <ListItem label="消息通知" hint={unread > 0 ? `${unread} 条未读` : ""} onClick={() => onGo("notifications")} />
      </TornCard>
      <TornCard className="mt-4" tilt="rotate-[-0.7deg]">
        <ListItem label="隐私与风险说明" onClick={() => onGo("privacy")} />
        <ListItem label="切换身份（我找家教）" onClick={onSwitch} />
      </TornCard>
      <TornCard className="mt-4" tilt="rotate-[0.6deg]">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-leaf mb-2">开发者的承诺</p>
        <p className="text-xs leading-relaxed text-ink/70">
          我们珍视每一位学生、每一笔交易，绝不克扣任何一笔信息费；我们始终与学生群体站在同一战线，用人工核验守护真实与信任。若有任何疑问或问题，请第一时间联系我们的代理人 Kiki，我们将负责到底。
        </p>
      </TornCard>
    </div>
  );
}

function Notifications({
  onBack,
  variant = "teacher",
  onUnreadChange,
}: {
  onBack: () => void;
  variant?: "teacher" | "parent";
  onUnreadChange: (n: number) => void;
}) {
  const [list, setList] = useState(
    variant === "parent"
      ? [
          { t: "有人报名", d: "你的需求已有老师报名，代理人正在核验，请留意后续推荐", time: "10 分钟前", unread: true },
          { t: "已推荐人选", d: "平台已为你推荐合适老师，请进入「我的需求」确认人选", time: "2 小时前", unread: true },
          { t: "需求发布成功", d: "你的需求已上架，符合条件的老师会陆续报名", time: "昨天", unread: true },
        ]
      : [
          { t: "报名被推荐", d: "你的报名已被代理人推荐给家长，请留意电话", time: "10 分钟前", unread: true },
          { t: "家长确认成交", d: "家长已确认你为「初三 · 数学」老师，代理人将尽快联系你", time: "2 小时前", unread: true },
          { t: "新需求上架", d: "新增 6 条符合你条件的需求，快去广场看看吧", time: "昨天", unread: true },
        ],
  );
  const unreadCount = list.filter((n) => n.unread).length;
  const markRead = (index: number) => {
    const next = list.map((n, i) => (i === index ? { ...n, unread: false } : n));
    setList(next);
    onUnreadChange(next.filter((n) => n.unread).length);
  };
  const markAllRead = () => {
    const next = list.map((n) => ({ ...n, unread: false }));
    setList(next);
    onUnreadChange(0);
  };
  const guide =
    variant === "parent"
      ? "重要节点通过微信订阅消息触达，站内信仅作记录备份。开启订阅后，有人报名、已推荐人选、需求发布成功等都会及时提醒你。"
      : "重要节点通过微信订阅消息触达，站内信仅作记录备份。开启订阅后，新需求、报名被推荐、家长确认成交等都会及时提醒你。";
  return (
    <div>
      <NavBar title="消息通知" onBack={onBack} />
      <TornCard tilt="rotate-[-0.5deg]" className="mb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink/60 leading-relaxed">{guide}</p>
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-ink/45">{unreadCount} 条未读</p>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-[11px] font-bold text-leaf underline underline-offset-2">
              全部已读
            </button>
          )}
        </div>
      </TornCard>
      {list.map((n, i) => (
        <TornCard
          key={i}
          className={`mb-3 ${n.unread ? "" : "opacity-70"}`}
          tilt={i % 2 ? "rotate-[0.7deg]" : "rotate-[-0.7deg]"}
          onClick={() => markRead(i)}
        >
          <div className="flex items-start gap-2">
            <span className={`size-2 rounded-full mt-1.5 shrink-0 ${n.unread ? "bg-leaf" : "bg-ink/20"}`} />
            <div>
              <p className="text-sm font-extrabold">{n.t}</p>
              <p className="text-xs text-ink/55 mt-0.5">{n.d}</p>
              <p className="text-[10px] text-ink/40 mt-1">{n.time}</p>
            </div>
          </div>
        </TornCard>
      ))}
    </div>
  );
}

function MultiPick({ label, options }: { label: string; options: string[] }) {
  const [picked, setPicked] = useState<string[]>([options[0]!]);
  return (
    <Field label={label}>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {options.map((o, i) => (
          <Chip
            key={o}
            active={picked.includes(o)}
            tilt={i % 2 ? "rotate-1" : "-rotate-1"}
            onClick={() =>
              setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]))
            }
          >
            {o}
          </Chip>
        ))}
      </div>
    </Field>
  );
}

function Resume({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [intro, setIntro] = useState("数学专业在读，带过 3 届中考冲刺，讲解耐心。");
  const introRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    if (introRef.current) autoGrow(introRef.current);
  }, []);

  return (
    <div>
      <NavBar title="简历管理" onBack={onBack} />
      <TornCard tilt="rotate-[0.5deg]">
        <MultiPick label="授课科目（多选）" options={["语文", "数学", "英语", "物理", "化学"]} />
        <MultiPick label="可带年级（多选）" options={["小学", "初中", "高中"]} />
        <MultiPick label="可授课时段" options={["周一至周五晚", "周六全天", "周日全天"]} />
        <Field
          label="期望时薪"
          hint="市场参考（元/时）：小学 80-120 · 初中 100-150 · 高中 120-180；艺术/编程等特长类通常上浮 20-40。仅作参考，可自由定价。"
        >
          <TextInput defaultValue="120" inputMode="numeric" />
        </Field>
        <Field label="可服务区域" hint="支持精确到小区/地标，如：岳麓区 · 麓山名园">
          <TextInput defaultValue="岳麓区" />
        </Field>
        <Field label="自我介绍（请尽量写全）">
          <textarea
            ref={introRef}
            rows={3}
            value={intro}
            onChange={(e) => {
              setIntro(e.target.value);
              autoGrow(e.target);
            }}
            placeholder="请尽量写全：① 学院 / 专业 / 年级；② 家教经历（带过哪些年级、科目）；③ 提分效果或教学成果。"
            className="w-full rounded-xl bg-paper border border-ink/10 px-3 py-2 text-sm font-semibold outline-none focus:border-leaf/50 resize-none overflow-hidden"
          />
        </Field>
        <PrimaryButton onClick={() => setSaved(true)}>
          {saved ? "已保存" : "保存简历"}
        </PrimaryButton>
      </TornCard>
      <PrivacyPolicyScroll />
    </div>
  );
}

function Verify({ onBack }: { onBack: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div>
      <NavBar title="实名 + 学籍认证" onBack={onBack} />
      <TornCard tilt="rotate-[-0.6deg]">
        <p className="text-xs text-ink/60 leading-relaxed">
          认证权益：通过后展示「已认证」标签，被代理人推荐的概率更高。请如实补充学院与专业，材料将用于平台人工核验。
        </p>
        <div className="grid grid-cols-1 gap-3 mt-4">
          <Field label="学院名称">
            <TextInput defaultValue="" placeholder="如：数学与统计学院" />
          </Field>
          <Field label="专业名称">
            <TextInput defaultValue="" placeholder="如：数学与应用数学" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="aspect-4/3 rounded-xl border-2 border-dashed border-ink/15 grid place-items-center text-xs font-bold text-ink/40">
            + 学生证
          </div>
          <div className="aspect-4/3 rounded-xl border-2 border-dashed border-ink/15 grid place-items-center text-xs font-bold text-ink/40">
            + 学信网截图
          </div>
        </div>
        <label className="flex items-center justify-between mt-4 text-xs font-bold">
          授权在简历中展示学院与专业信息
          <input type="checkbox" defaultChecked className="accent-leaf size-4" />
        </label>
        <div className="mt-4">
          {submitted ? <StatusTag status="待审核" /> : null}
          <div className="mt-2">
            <PrimaryButton onClick={() => setSubmitted(true)} disabled={submitted}>
              {submitted ? "已提交，等待审核" : "提交认证"}
            </PrimaryButton>
          </div>
        </div>
      </TornCard>
    </div>
  );
}

function Publish({ onSubmit }: { onSubmit: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [gender, setGender] = useState("不限");
  const [budgetMin, setBudgetMin] = useState("100");
  const [budgetMax, setBudgetMax] = useState("150");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [location, setLocation] = useState("");
  const budgetDirty = useRef(false); // 用户手动改过预算后，不再被推荐区间覆盖
  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const genders = ["不限", "男", "女"];
  const gradeOptions = ["小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级", "初一", "初二", "初三", "高一", "高二", "高三"];
  const subjectOptions = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治", "音乐", "美术", "少儿编程", "羽毛球", "篮球", "钢琴"];
  const goalOptions = ["0基础学新课", "巩固基础", "培优拔高"];

  // —— 预算按学段给出市场参考区间（家长可在此基础上微调）——
  const stageOf = (g: string) =>
    g.includes("小学") ? "小学" : g.includes("初") ? "初中" : g.includes("高") ? "高中" : null;
  /** 学科类 vs 兴趣/特长类的参考区间（元/时） */
  const REF_BUDGET: Record<"小学" | "初中" | "高中", { main: [number, number]; extra: [number, number] }> = {
    小学: { main: [80, 120], extra: [100, 160] },
    初中: { main: [100, 150], extra: [110, 180] },
    高中: { main: [120, 180], extra: [130, 220] },
  };
  const EXTRA_SUBJECTS = ["音乐", "美术", "少儿编程", "羽毛球", "篮球", "钢琴"];
  const stage = stageOf(grade);
  const applyRefBudget = (s: "小学" | "初中" | "高中", isExtra: boolean) => {
    const ref = REF_BUDGET[s][isExtra ? "extra" : "main"];
    setBudgetMin(String(ref[0]));
    setBudgetMax(String(ref[1]));
  };
  const handleGradeChange = (g: string) => {
    setGrade(g);
    budgetDirty.current = false;
    const s = stageOf(g);
    if (s) applyRefBudget(s, false);
  };
  const handleSubjectChange = (v: string[]) => {
    setSubject(v);
    if (!budgetDirty.current && stage) {
      applyRefBudget(stage, v.some((x) => EXTRA_SUBJECTS.includes(x)));
    }
  };

  const budgetValid = !(budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax));
  const canSubmit = agreed && grade && subject.length > 0 && goal && location && budgetValid;

  return (
    <div>
      <Header sub="家长端 · 找家教" title="发布需求" />
      <TornCard tilt="rotate-[0.6deg]">
        <SelectField
          label="孩子年级"
          value={grade}
          placeholder="请选择年级"
          options={gradeOptions}
          onChange={(v) => handleGradeChange(v as string)}
          required
        />
        <SelectField
          label="辅导科目（可多选）"
          value={subject}
          placeholder="请选择科目"
          options={subjectOptions}
          onChange={(v) => handleSubjectChange(v as string[])}
          required
          multiple
        />
        <SelectField
          label="辅导类型"
          value={goal}
          placeholder="请选择类型"
          options={goalOptions}
          onChange={(v) => setGoal(v as string)}
          required
        />
        <Field label="偏好老师">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {genders.map((g, i) => (
              <Chip
                key={g}
                active={gender === g}
                tilt={i % 2 ? "rotate-1" : "-rotate-1"}
                onClick={() => setGender(g)}
              >
                {g}
              </Chip>
            ))}
          </div>
        </Field>
        <MultiPick
          label="期望时段（可多选）"
          options={["周一至周五晚", "周六全天", "周日全天", "周末均可"]}
        />
        <MultiPick
          label="上课区域（行政区 · 可多选）"
          options={districts}
        />
        <Field label="上课地点（精确到小区，必填）" hint="选择行政区后，请在此填写小区/地标与楼栋，便于老师判断通勤距离">
          <TextInput
            placeholder="如：麓山名园 X 栋 / 师大附小旁（必填）"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>
        <RiskNote>⚠ 联系电话和上课地点很重要！请务必填写真实信息，否则无法与老师对接。</RiskNote>
        <Field label="预算范围（元/时）"
          hint={
            stage
              ? `已按「${stage}学段${subject.some((x) => EXTRA_SUBJECTS.includes(x)) ? "· 兴趣特长类" : "· 学科类"}」自动带入市场参考区间，可自行微调`
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            <input
              value={budgetMin}
              onChange={(e) => {
                budgetDirty.current = true;
                setBudgetMin(onlyDigits(e.target.value));
              }}
              inputMode="numeric"
              placeholder="最低"
              className="w-full rounded-xl bg-paper border border-ink/10 px-3 py-2 text-sm font-semibold outline-none focus:border-leaf/50"
            />
            <span className="text-xs text-ink/45">—</span>
            <input
              value={budgetMax}
              onChange={(e) => {
                budgetDirty.current = true;
                setBudgetMax(onlyDigits(e.target.value));
              }}
              inputMode="numeric"
              placeholder="最高"
              className="w-full rounded-xl bg-paper border border-ink/10 px-3 py-2 text-sm font-semibold outline-none focus:border-leaf/50"
            />
            <span className="text-xs font-bold text-ink/50 shrink-0">元/时</span>
          </div>
          {!budgetValid && (
            <p className="text-[11px] font-bold text-red-500 mt-1.5">最低预算不能高于最高预算，请调整。</p>
          )}
        </Field>
        <Field label="联系电话">
          <TextInput defaultValue="138****6688" inputMode="tel" />
        </Field>
        <Field label="补充说明（选填）">
          <TextInput placeholder="如：孩子性格、其他要求及备注等" />
        </Field>
        <div className="mb-3">
          <RiskNote>本平台仅做信息撮合、不代收课时费。老师的身份与学籍信息由平台代理人亲自人工核验，如发现信息不实，请立即联系代理人 Kiki，我们将承担责任并跟进处理。</RiskNote>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-bold text-ink/60 mb-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="accent-leaf size-4"
          />
          我已阅读并同意风险提示与隐私说明
        </label>
        <PrimaryButton onClick={onSubmit} disabled={!canSubmit}>
          提交需求（提交即上架）
        </PrimaryButton>
      </TornCard>
      <PrivacyPolicyScroll />
    </div>
  );
}

function MyDemands({
  onOpen,
  confirmedTeacher,
  orders,
}: {
  onOpen: (d: Demand) => void;
  confirmedTeacher: Record<string, string>;
  orders: SharedOrder[];
}) {
  return (
    <div>
      <Header sub="家长端 · 进度" title="我的需求" />
      {parentDemands.map((d, i) => {
        const order = orders.find((o) => o.demandId === d.id);
        const chosen = confirmedTeacher[d.id];
        const displayStatus = order?.status === "已成交" ? "已成交" : chosen ? "已确认" : d.status;
        return (
          <TornCard key={d.id} className="mb-4" tilt={i % 2 ? "rotate-[-0.8deg]" : "rotate-[0.7deg]"}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-extrabold">
                {d.grade} · {d.subject} {d.title}
              </h3>
              <StatusTag status={displayStatus} />
            </div>
            <p className="text-xs text-ink/55 mt-1">
              {d.applicants} 位老师报名 · {d.recommended} 位已推荐
            </p>
            {chosen && <p className="text-xs font-bold text-leaf mt-2">✅ 已选老师：{chosen}</p>}
            {chosen ? (
              <div className="mt-3">
                <GhostButton onClick={() => onOpen(d)}>查看进度</GhostButton>
              </div>
            ) : d.recommended > 0 ? (
              <div className="mt-3">
                <PrimaryButton onClick={() => onOpen(d)}>去确认人选</PrimaryButton>
              </div>
            ) : (
              <div className="mt-3">
                <GhostButton onClick={() => onOpen(d)}>查看报名进度</GhostButton>
              </div>
            )}
          </TornCard>
        );
      })}
    </div>
  );
}

function ParentDemandDetail({
  demand,
  onBack,
  confirmedTeacher,
  onConfirmTeacher,
  onInterestTeacher,
  interestedTeachers,
  onViewResume,
}: {
  demand: Demand;
  onBack: () => void;
  confirmedTeacher: Record<string, string>;
  onConfirmTeacher: (demandId: string, teacher: string) => void;
  onInterestTeacher: (demandId: string, teacher: string) => void;
  interestedTeachers: string[];
  onViewResume: (t: Teacher) => void;
}) {
  const [askingContact, setAskingContact] = useState(false);
  const list: Applicant[] = applicantsByDemand[demand.id] ?? [];
  const recommended = list.filter((a) => a.recommended);
  const others = list.filter((a) => !a.recommended);
  const confirmedName = confirmedTeacher[demand.id] ?? null;

  const renderCard = (t: Applicant, i: number) => (
    <ApplicantCard
      key={t.id}
      applicant={t}
      index={i}
      confirmedName={confirmedName}
      interested={interestedTeachers.includes(t.name)}
      onConfirm={(name) => onConfirmTeacher(demand.id, name)}
      onInterest={(name) => onInterestTeacher(demand.id, name)}
      onViewResume={onViewResume}
    />
  );

  return (
    <div>
      <NavBar title="需求详情" onBack={onBack} />
      <TornCard tilt="rotate-[0.5deg]">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-extrabold">
            {demand.grade} · {demand.subject} {demand.title}
          </h3>
          <StatusTag status={demand.status} />
        </div>
        <p className="text-xs text-ink/55 mt-1">
          报名进度：{demand.applicants} 人报名，{demand.recommended} 人推荐
        </p>
        <p className="text-[11px] text-ink/45 mt-1">
          {demand.time} · {demand.area}
        </p>
      </TornCard>

      {recommended.length > 0 && (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-leaf mt-5 mb-2">
            ⭐ 平台推荐人选（置顶）
          </p>
          {recommended.map((t, i) => renderCard(t, i))}
        </>
      )}

      {others.length > 0 && (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/40 mt-5 mb-2">
            其他报名老师
          </p>
          {others.map((t, i) => renderCard(t, i))}
        </>
      )}

      {confirmedName && (
        <TornCard className="mt-4 mb-4" tilt="rotate-[0.4deg]">
          <p className="text-[11px] text-ink/50 leading-relaxed">
            ✅ 主选已确认为「{confirmedName}」。如仍想对比试课，可对其他老师点「想进一步了解」，代理人将为您协调安排。
          </p>
        </TornCard>
      )}

      <TornCard className="mt-4 mb-4" tilt="rotate-[-0.3deg]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold">💬 需求疑问？直接问代理人</p>
            <p className="text-[11px] text-ink/50 mt-0.5">
              催办推荐、更换人选、取消需求等，一键联系平台代理人（Kiki）
            </p>
          </div>
          <PrimaryButton onClick={() => setAskingContact(true)} className="!py-2 !px-4 !text-xs shrink-0">
            联系代理人
          </PrimaryButton>
        </div>
      </TornCard>

      <TornCard className="mt-4" tilt="rotate-[-0.5deg]">
        <p className="text-[11px] text-ink/50 leading-relaxed">
          确认后平台将为你牵线对接，代理人会通过电话联系您，请保持电话畅通。
        </p>
      </TornCard>

      <ConfirmDialog
        open={askingContact}
        title="联系平台代理人"
        message="正式上线后，点击此处将唤起微信内置客服会话，直接与平台代理人（Kiki）沟通。当前为界面预览，此入口仅为流程演示。"
        confirmText="知道了"
        cancelText="关闭"
        onCancel={() => setAskingContact(false)}
        onConfirm={() => setAskingContact(false)}
      />
    </div>
  );
}

function ApplicantCard({
  applicant,
  index,
  confirmedName,
  interested,
  onConfirm,
  onInterest,
  onViewResume,
}: {
  applicant: Applicant;
  index: number;
  confirmedName: string | null;
  /** 家长已对该老师表达"想进一步了解/试课" */
  interested: boolean;
  onConfirm: (name: string) => void;
  onInterest: (name: string) => void;
  onViewResume: (t: Teacher) => void;
}) {
  const [asking, setAsking] = useState(false);
  const isConfirmed = confirmedName === applicant.name;
  /** 已确认了别的老师：此卡片只能"想进一步了解"，不能重复确认 */
  const hasOtherConfirmed = confirmedName !== null && !isConfirmed;
  return (
    <TornCard className="mb-4" tilt={index % 2 ? "rotate-[-0.8deg]" : "rotate-[0.7deg]"}>
      <div className="flex items-start gap-3">
        <img
          src={avatars[index % avatars.length]}
          alt={`${applicant.name}老师头像`}
          width={512}
          height={512}
          loading="lazy"
          className="size-14 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-base font-extrabold">{applicant.name} 老师</h3>
            <VerifyTag verified={applicant.verified} />
            {applicant.recommended && (
              <span className="text-[10px] font-bold text-amber bg-amber/15 border border-amber/40 px-1.5 py-0.5 rounded-full">
                平台推荐
              </span>
            )}
          </div>
          <p className="text-xs text-ink/55 mt-0.5">
            {collegeMajorText(applicant) || "在读大学生"} · {applicant.rate}
          </p>
          <p className="text-xs text-ink/55 mt-0.5">
            {applicant.subject} · {applicant.meta}
          </p>
          <p className="font-hand text-lg text-pine mt-2 leading-none">“{applicant.quote}”</p>
          <button
            onClick={() => onViewResume(applicant)}
            className="text-[11px] font-bold text-leaf underline underline-offset-2 mt-2 block"
          >
            查看完整简历 ›
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isConfirmed ? (
              <GhostButton disabled>已确认该老师</GhostButton>
            ) : hasOtherConfirmed ? (
              interested ? (
                <GhostButton disabled>✓ 已表达意向，等待代理人联系</GhostButton>
              ) : (
                <PrimaryButton onClick={() => onInterest(applicant.name)}>
                  想进一步了解该老师
                </PrimaryButton>
              )
            ) : (
              <PrimaryButton onClick={() => setAsking(true)}>
                {applicant.recommended ? "确认选择该老师" : "选择该老师"}
              </PrimaryButton>
            )}
          </div>
        </div>
      </div>
      {isConfirmed && (
        <p className="text-[11px] font-bold text-leaf bg-leaf/10 border border-leaf/30 rounded-lg px-2.5 py-1.5 mt-3 -rotate-1">
          ✅ 已通知平台处理，代理人将尽快联系您线下对接
        </p>
      )}
      {interested && !isConfirmed && (
        <p className="text-[11px] font-bold text-amber bg-amber/15 border border-amber/40 rounded-lg px-2.5 py-1.5 mt-3 rotate-1">
          🧪 已通知代理人安排试课，请留意电话
        </p>
      )}
      <ConfirmDialog
        open={asking}
        title="确认选择这位老师？"
        message={`确认选择「${applicant.name}」老师后，平台代理人将尽快联系您线下对接。确认后如需更换，请先联系代理人。`}
        confirmText="确认选择"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onConfirm(applicant.name);
        }}
      />
    </TornCard>
  );
}

function TeacherResume({ teacher, onBack }: { teacher: Teacher; onBack: () => void }) {
  return (
    <div>
      <NavBar title="老师简历" onBack={onBack} />
      <TornCard tilt="rotate-[0.5deg]" className="mb-4">
        <div className="flex items-center gap-3">
          <img
            src={tutor1}
            alt={`${teacher.name}老师头像`}
            width={512}
            height={512}
            loading="lazy"
            className="size-14 shrink-0 rounded-2xl object-cover"
          />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-base font-extrabold">{teacher.name} 老师</h3>
              <VerifyTag verified={teacher.verified} />
            </div>
            <p className="text-xs text-ink/55 mt-0.5">{collegeMajorText(teacher) || "在读大学生"}</p>
          </div>
        </div>
      </TornCard>
      <TornCard tilt="rotate-[-0.7deg]">
        <Row label="授课科目" value={teacher.resume.subjects.join("、")} />
        <Row label="可带年级" value={teacher.resume.grades.join("、")} />
        <Row label="可授课时段" value={teacher.resume.times.join("、")} />
        <Row label="期望时薪" value={teacher.rate} />
        <Row label="可服务区域" value={teacher.resume.area} />
        <div className="mt-3">
          <p className="text-[11px] font-bold text-ink/50">自我介绍</p>
          <p className="text-xs text-ink/70 mt-1 leading-relaxed whitespace-pre-wrap">{teacher.resume.intro}</p>
        </div>
      </TornCard>
    </div>
  );
}

function ParentMe({ onGo, onSwitch, unread }: { onGo: (s: Screen) => void; onSwitch: () => void; unread: number }) {
  const [askingContact, setAskingContact] = useState(false);
  return (
    <div>
      <Header sub="家长端 · 个人中心" title="我的" />
      <ProfileHead name="王女士" desc="岳麓区 · 2 个孩子" avatar={tutor2} />
      <TornCard tilt="rotate-[0.6deg]">
        <ListItem label="浏览认证老师" onClick={() => onGo("teacherList")} />
        <ListItem label="我的联系方式" hint="去完善" onClick={() => onGo("parentContact")} />
        <ListItem label="消息通知" hint={unread > 0 ? `${unread} 条未读` : ""} onClick={() => onGo("notifications")} />
        <ListItem label="联系代理人" hint="催办 / 咨询" onClick={() => setAskingContact(true)} />
      </TornCard>
      <TornCard className="mt-4" tilt="rotate-[-0.7deg]">
        <ListItem label="隐私与风险说明" onClick={() => onGo("privacy")} />
        <ListItem label="切换身份（我来接单）" onClick={onSwitch} />
      </TornCard>
      <ConfirmDialog
        open={askingContact}
        title="联系平台代理人"
        message="正式上线后，点击此处将唤起微信内置客服会话，直接与平台代理人（Kiki）沟通。当前为界面预览，此入口仅为流程演示。"
        confirmText="知道了"
        cancelText="关闭"
        onCancel={() => setAskingContact(false)}
        onConfirm={() => setAskingContact(false)}
      />
    </div>
  );
}

function TeacherList({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <NavBar title="认证老师" onBack={onBack} />
      {teachers.map((t, i) => (
        <TornCard key={t.id} className="mb-4" tilt={i % 2 ? "rotate-[-0.8deg]" : "rotate-[0.7deg]"}>
          <div className="flex items-start gap-3">
            <img
              src={avatars[i % avatars.length]}
              alt={`${t.name}老师头像`}
              width={512}
              height={512}
              loading="lazy"
              className="size-14 shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base font-extrabold">
                  {t.name} · {t.subject}
                </h3>
                <VerifyTag verified={t.verified} />
              </div>
              <p className="text-xs text-ink/55 mt-0.5">
                {collegeMajorText(t) || "在读大学生"} · {t.rate}
              </p>
              <p className="font-hand text-lg text-pine mt-2 leading-none">“{t.quote}”</p>
            </div>
          </div>
        </TornCard>
      ))}
      <p className="text-[11px] text-ink/50">
        联系老师请发布需求，平台将为你匹配合适老师。
      </p>
    </div>
  );
}

function ParentContact({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState("138****6688");
  const [wechat, setWechat] = useState("");
  const [name, setName] = useState("王女士");
  const [area, setArea] = useState("岳麓区");
  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const canSave = phone && name && area;

  return (
    <div>
      <NavBar title="我的联系方式" onBack={onBack} />
      <TornCard tilt="rotate-[0.5deg]">
        <p className="text-xs text-ink/60 leading-relaxed">
          平台代理人会通过以下联系方式与您对接，请确保信息真实有效。联系方式不会在广场公开展示。
        </p>
        <div className="mt-4">
          <Field label="称呼">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入称呼，如：王女士"
            />
          </Field>
          <Field label="联系电话">
            <TextInput
              value={phone}
              onChange={(e) => setPhone(onlyDigits(e.target.value))}
              inputMode="tel"
              placeholder="请输入手机号"
            />
          </Field>
          <Field label="微信号（选填）">
            <TextInput
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              placeholder="请输入微信号，便于代理人添加"
            />
          </Field>
          <Field label="所在区域">
            <TextInput
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="请输入所在区域，可精确到小区，如：岳麓区 · 麓山名园"
            />
          </Field>
        </div>
        <RiskNote>⚠ 联系方式仅用于平台代理人对接，不会在广场公开展示，请放心填写。</RiskNote>
        <div className="mt-4">
          <PrimaryButton onClick={() => setSaved(true)} disabled={!canSave}>
            {saved ? "已保存" : "保存联系方式"}
          </PrimaryButton>
        </div>
      </TornCard>
      <TornCard className="mt-4" tilt="rotate-[-0.7deg]">
        <p className="text-[11px] text-ink/50 leading-relaxed">
          修改联系方式后，平台会以最新信息与您对接。如长时间未接到代理人电话，请检查联系方式是否正确。
        </p>
      </TornCard>
    </div>
  );
}

function TeacherContact({ onBack }: { onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [phone, setPhone] = useState("");
  const [wechat, setWechat] = useState("");
  const [name, setName] = useState("张同学");
  const [area, setArea] = useState("");
  const onlyDigits = (v: string) => v.replace(/\D/g, "");
  const canSave = phone && area;

  return (
    <div>
      <NavBar title="我的联系方式" onBack={onBack} />
      <TornCard tilt="rotate-[0.5deg]">
        <p className="text-xs text-ink/60 leading-relaxed">
          平台代理人会通过以下联系方式与您对接，请确保信息真实有效。联系方式不会在广场公开展示。
        </p>
        <div className="mt-4">
          <Field label="称呼">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入称呼，如：张同学"
            />
          </Field>
          <Field label="联系电话（必填）">
            <TextInput
              value={phone}
              onChange={(e) => setPhone(onlyDigits(e.target.value))}
              inputMode="tel"
              placeholder="请输入手机号（必填）"
            />
          </Field>
          <Field label="微信号（选填）">
            <TextInput
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              placeholder="请输入微信号，便于代理人添加"
            />
          </Field>
          <Field label="所在区域（必填）">
            <TextInput
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="请输入所在区域，可精确到小区，如：岳麓区 · 麓山名园"
            />
          </Field>
        </div>
        <RiskNote>⚠ 手机号和所在区域为必填，否则代理人无法与您对接。联系方式仅用于平台代理人对接，不会在广场公开展示。</RiskNote>
        <div className="mt-4">
          <PrimaryButton onClick={() => setSaved(true)} disabled={!canSave}>
            {saved ? "已保存" : "保存联系方式"}
          </PrimaryButton>
        </div>
      </TornCard>
      <TornCard className="mt-4" tilt="rotate-[-0.7deg]">
        <p className="text-[11px] text-ink/50 leading-relaxed">
          修改联系方式后，平台会以最新信息与您对接。如长时间未接到代理人电话，请检查联系方式是否正确。
        </p>
      </TornCard>
    </div>
  );
}
