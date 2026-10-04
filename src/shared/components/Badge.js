"use client";

import { cn } from "@/shared/utils/cn";

/* Status chips. Every variant pulls from the semantic token triplet, so the
   same chip is legible in light and dark without a single dark: override. */
const variants = {
  default: "bg-surface-2 text-text-muted border-border-subtle",
  primary: "bg-brand-500/12 text-primary border-brand-500/25",
  success: "bg-success-bg text-success-fg border-success-border",
  warning: "bg-warning-bg text-warning-fg border-warning-border",
  error: "bg-danger-bg text-danger-fg border-danger-border",
  info: "bg-info-bg text-info-fg border-info-border",
};

const dotColors = {
  default: "bg-text-subtle",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
  info: "bg-info",
};

const sizes = {
  sm: "px-1.5 py-px text-[10px] gap-1",
  md: "px-2 py-0.5 text-[11px] gap-1.5",
  lg: "px-2.5 py-1 text-xs gap-1.5",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full shrink-0", dotColors[variant])} />}
      {icon && <span className="material-symbols-outlined text-[13px] leading-none">{icon}</span>}
      {children}
    </span>
  );
}
