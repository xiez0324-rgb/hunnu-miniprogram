import { useEffect, useRef, useState, type ReactNode } from "react";

export function TornCard({
  children,
  className = "",
  tilt = "rotate-[-0.6deg]",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  tilt?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`torn bg-surface p-4 relative shadow-[var(--shadow-paper)] overflow-visible ${tilt} ${className}`}
    >
      {children}
    </div>
  );
}

const tagStyles: Record<string, string> = {
  已报名: "bg-mint/40 text-pine",
  已推荐: "bg-sky/30 text-skydeep",
  已确认: "bg-leaf/15 text-leaf border border-leaf/30",
  已成交: "bg-ink/8 text-ink/60",
  已取消: "bg-ink/5 text-ink/40",
  进行中: "bg-mint/40 text-pine",
  待审核: "bg-amber/20 text-amber",
  已驳回: "bg-amber/25 text-amber",
  已下架: "bg-ink/5 text-ink/40",
};

export function StatusTag({ status }: { status: string }) {
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        tagStyles[status] ?? "bg-ink/5 text-ink/50"
      }`}
    >
      {status}
    </span>
  );
}

export function VerifyTag({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="text-[10px] font-bold text-leaf bg-leaf/15 border border-leaf/30 px-2 py-0.5 rounded-full">
      已认证
    </span>
  ) : (
    <span className="text-[10px] font-bold text-ink/45 bg-ink/5 px-2 py-0.5 rounded-full">
      未认证
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2.5 rounded-xl text-sm font-extrabold -rotate-1 transition-transform active:scale-[0.98] ${
        disabled
          ? "bg-ink/10 text-ink/40"
          : "bg-leaf text-paper shadow-[var(--shadow-btn)]"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2.5 rounded-xl bg-surface border-2 border-ink/15 text-ink/60 text-sm font-extrabold rotate-1 transition-transform active:scale-[0.98] ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  active,
  tilt = "",
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  tilt?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold ${tilt} ${
        active
          ? "bg-ink text-paper"
          : "bg-surface text-ink/60 border border-ink/10 font-semibold"
      }`}
    >
      {children}
    </button>
  );
}

export function NavBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        onClick={onBack}
        aria-label="返回"
        className="size-8 rounded-full bg-surface border border-ink/10 grid place-items-center text-ink/60 font-bold"
      >
        ‹
      </button>
      <h2 className="text-lg font-extrabold">{title}</h2>
    </div>
  );
}

export function Row({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-dashed border-ink/10 last:border-0">
      <span className="text-xs text-ink/45 w-20 shrink-0">{label}</span>
      <span className="text-xs font-semibold text-ink flex-1">{value}</span>
    </div>
  );
}

export function ListItem({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 border-b border-dashed border-ink/10 last:border-0 text-left"
    >
      <span className="text-sm font-bold">{label}</span>
      <span className="flex items-center gap-2">
        {hint ? <span className="text-[11px] text-amber font-bold">{hint}</span> : null}
        <span className="text-ink/30">›</span>
      </span>
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="text-[11px] font-bold text-ink/50">{label}</span>
      {hint ? <span className="block text-[10px] text-ink/40 mt-0.5">{hint}</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl bg-paper border border-ink/10 px-3 py-2 text-sm font-semibold outline-none focus:border-leaf/50"
    />
  );
}

export function RiskNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 bg-amber/15 border border-amber/40 rounded-lg px-2.5 py-1.5 -rotate-1">
      <span className="text-amber text-xs font-extrabold leading-none mt-0.5">!</span>
      <span className="text-[11px] font-semibold text-amber leading-snug">{children}</span>
    </div>
  );
}

/** 二次确认弹窗：用于取消报名、确认人选等高风险操作，避免误触 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs bg-surface border-4 border-dashed border-ink/20 rounded-2xl shadow-[var(--shadow-paper)] p-5 rotate-[-0.5deg]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-extrabold">{title}</p>
        <p className="text-xs text-ink/60 mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-ink/5 text-ink/60 text-sm font-extrabold"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-leaf text-paper text-sm font-extrabold shadow-[var(--shadow-btn)]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 筛选栏下拉面板：fixed 定位贴在筛选栏正下方，
 * 从筛选栏位置向下展开（opacity + scale 过渡），脱离 MiniApp 容器的 overflow 裁切。
 * 全屏遮罩层点击收起。left/width 动态匹配筛选栏尺寸。
 */
export function DropdownPanel({
  visible,
  onClose,
  title,
  children,
  top = 210,
  left,
  width,
  ...rest
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  top?: number;
  left?: number;
  width?: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  if (!visible) return null;
  return (
    <div
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
      style={{
        top,
        left: left ?? "50%",
        width: width ?? 390,
        ...(left === undefined ? { transform: "translateX(-50%)" } : {}),
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * 筛选项行：左侧文字，选中态右侧 ✓，整行可点。
 */
export function FilterOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 text-left ${
        selected ? "text-emerald-600 font-extrabold bg-emerald-50/50" : "text-gray-600 font-medium"
      }`}
    >
      <span className="text-sm">{label}</span>
      {selected && <span className="text-emerald-500 font-extrabold text-base">✓</span>}
    </button>
  );
}

/** 发布需求页的下拉选择：支持单选和多选模式 */
export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  required = false,
  multiple = false,
}: {
  label: string;
  value: string | string[];
  placeholder: string;
  options: string[];
  onChange: (v: string | string[]) => void;
  required?: boolean;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const isSelected = (opt: string) =>
    multiple ? (value as string[]).includes(opt) : opt === value;

  const displayText = (() => {
    if (multiple) {
      const arr = value as string[];
      return arr.length > 0 ? arr.join("、") : "";
    }
    return value as string;
  })();

  const toggle = (opt: string) => {
    if (multiple) {
      const arr = value as string[];
      const next = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt];
      onChange(next);
    } else {
      onChange(opt);
      setOpen(false);
    }
  };

  // 点击外部收起（仅单选模式自动收起）
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-select-panel]")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="block mb-3" data-select-panel>
      <span className="text-[11px] font-bold text-ink/50">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="relative mt-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between rounded-xl bg-paper border px-3 py-2 text-sm font-semibold transition-colors ${
            open ? "border-emerald-500" : "border-ink/10 hover:border-ink/20"
          }`}
        >
          <span className={displayText ? "text-ink" : "text-ink/35"}>
            {displayText || placeholder}
          </span>
          <span className={`text-ink/40 text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>

        {open && (
          <div
            className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {options.map((opt) => {
              const selected = isSelected(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(opt);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 text-left ${
                    selected ? "text-emerald-600 font-extrabold bg-emerald-50/50" : "text-gray-600 font-medium"
                  }`}
                >
                  <span className="text-sm">{opt}</span>
                  {selected && <span className="text-emerald-500 font-extrabold text-base">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
