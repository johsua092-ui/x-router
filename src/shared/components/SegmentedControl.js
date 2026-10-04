"use client";

import { cn } from "@/shared/utils/cn";

/* SegmentedControl. Pro-tier tab switcher with high contrast active state
   and crisp responsive wrapping. */
export default function SegmentedControl({ options = [], value, onChange, size = "md", className }) {
  const sizes = {
    sm: "h-7 text-xs px-2.5",
    md: "h-8 text-xs sm:text-[13px] px-3",
    lg: "h-9 text-sm px-4",
  };

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1 p-1 rounded-[6px] bg-surface border border-border shadow-[var(--shadow-elev)]",
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
              "shrink-0 inline-flex items-center gap-1.5 rounded-[4px] font-medium transition-all duration-150 cursor-pointer select-none",
              sizes[size],
              active
                ? "bg-brand-500 text-white font-semibold shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-surface-2"
            )}
          >
            {option.icon && (
              <span className="material-symbols-outlined text-[15px] leading-none shrink-0">
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
