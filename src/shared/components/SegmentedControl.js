"use client";

import { cn } from "@/shared/utils/cn";

/* Tabs. The active item is marked by a solid surface + ember underline instead
   of a shadow, so the selected tab is unmistakable at a glance. */
export default function SegmentedControl({ options = [], value, onChange, size = "md", className }) {
  const sizes = {
    sm: "h-7 text-xs px-3",
    md: "h-8 text-[13px] px-3.5",
    lg: "h-10 text-sm px-4",
  };

  return (
    <div
      className={cn(
        // Wrap rather than scroll: a tab you cannot see does not exist.
        "inline-flex flex-wrap items-center gap-0.5 p-0.5 rounded-[9px]",
        "bg-surface-2 border border-border-subtle",
        className
      )}
      role="tablist"
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 rounded-[7px] font-medium transition-colors",
              sizes[size],
              active
                ? "bg-surface text-text-main border border-brand-500/40"
                : "text-text-muted hover:text-text-main border border-transparent"
            )}
          >
            {option.icon && (
              <span className="material-symbols-outlined text-[15px] leading-none">
                {option.icon}
              </span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
