"use client";

export function Card({ title, sub, icon, action, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-border-subtle bg-surface shadow-[var(--shadow-soft)] p-5 transition-all ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <span className="inline-flex items-center justify-center size-[34px] rounded-[10px] bg-primary/10 border border-primary/20 text-primary shrink-0">
                <span className="material-symbols-outlined text-[19px]">{icon}</span>
              </span>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-main">{title}</div>
              {sub && <div className="text-xs text-text-muted mt-0.5">{sub}</div>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, meta, icon, tone = "", spark }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface shadow-[var(--shadow-soft)] p-4">
      <div className="text-[11.5px] font-semibold tracking-wide uppercase text-text-subtle flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[15px]">{icon}</span>
        {label}
      </div>
      <div className={`text-3xl font-bold tracking-tight mt-2 tabular-nums ${tone}`}>{value}</div>
      {meta && <div className="text-xs text-text-muted mt-1">{meta}</div>}
      {spark && <div className="mt-2">{spark}</div>}
    </div>
  );
}

export function Pill({ tone = "on", children }) {
  const map = {
    on: "border-green-500/25 bg-green-500/10 text-green-500",
    off: "border-red-500/25 bg-red-500/10 text-red-500",
    warn: "border-amber-500/25 bg-amber-500/10 text-amber-500",
    info: "border-blue-500/25 bg-blue-500/10 text-blue-500",
    plain: "border-border bg-surface-2 text-text-muted",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2 py-[3px] rounded-full border whitespace-nowrap ${map[tone]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Button({
  children, variant = "secondary", size = "md", icon, onClick, type = "button",
  disabled, className = "", href, ...rest
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-semibold rounded-[10px] border transition-all active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "h-7 px-3 text-xs",
    md: "h-[34px] px-4 text-[13px]",
    lg: "h-10 px-5 text-sm",
    icon: "h-[34px] w-[34px] px-0",
    "icon-sm": "h-7 w-7 px-0",
  };
  const variants = {
    primary:
      "bg-gradient-to-b from-brand-500 to-brand-600 text-white border-transparent hover:from-brand-600 hover:to-brand-700 shadow-[var(--shadow-warm)]",
    secondary: "bg-surface-2 text-text-main border-border hover:border-primary/40",
    ghost: "bg-transparent text-text-muted border-transparent hover:bg-surface-2 hover:text-text-main",
    outline: "bg-transparent text-text-main border-border hover:bg-surface-2 hover:border-primary/40",
    danger: "bg-red-500 text-white border-transparent hover:brightness-90",
  };
  const cls = `${base} ${sizes[size] || sizes.md} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {icon && <span className="material-symbols-outlined text-[17px]">{icon}</span>}
        {children}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} {...rest}>
      {icon && <span className="material-symbols-outlined text-[17px]">{icon}</span>}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-text-subtle">{hint}</span>}
    </label>
  );
}
