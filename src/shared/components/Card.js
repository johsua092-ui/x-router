"use client";

import { cn } from "@/shared/utils/cn";

/* Panel = the page's structural layer, rebuilt as an industrial slab: near-square
   corners, one hairline border, a divided header strip, and an optional ember
   bar down the left edge. This is deliberately not the soft floating card of
   the upstream template — panels read as instrument plates. No translucency. */

const paddings = {
  none: "",
  xs: "p-3",
  sm: "p-4",
  md: "p-[18px]",
  lg: "p-6",
};

export default function Card({
  children,
  title,
  subtitle,
  icon,
  action,
  padding = "md",
  hover = false,
  elev = false,
  accent = false,
  className,
  ...props
}) {
  const hasHeader = Boolean(title || action);
  const bodyPad = paddings[padding] ?? paddings.md;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-surface border border-border rounded-[6px]",
        elev ? "shadow-[var(--shadow-elev)]" : "shadow-none",
        hover &&
          "transition-[border-color,transform] duration-200 cursor-pointer hover:border-brand-500/55 hover:-translate-y-px",
        accent && "pl-[3px]",
        !hasHeader && bodyPad,
        className
      )}
      {...props}
    >
      {/* Ember edge — the single brand gesture, opt-in per panel. */}
      {accent && (
        <span
          className="absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(180deg,var(--brand-400),var(--brand-600))]"
          aria-hidden="true"
        />
      )}

      {hasHeader && (
        <>
          <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {icon && (
                <span className="material-symbols-outlined shrink-0 text-[18px] leading-none text-primary">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                {title && (
                  <h3 className="truncate text-[12.5px] font-semibold uppercase tracking-[0.05em] text-text-main">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="mt-0.5 truncate text-[11px] leading-snug text-text-muted">{subtitle}</p>
                )}
              </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          <div className={bodyPad}>{children}</div>
        </>
      )}

      {!hasHeader && children}
    </div>
  );
}

Card.Section = function CardSection({ children, className, ...props }) {
  return (
    <div
      className={cn("rounded-[4px] border border-border-subtle bg-bg-alt p-4", className)}
      {...props}
    >
      {children}
    </div>
  );
};

Card.Row = function CardRow({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "border-b border-border-subtle py-2.5 transition-colors last:border-b-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

Card.ListItem = function CardListItem({ children, actions, className, ...props }) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-3 border-b border-border-subtle py-2.5 last:border-b-0",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
};
