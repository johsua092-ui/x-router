"use client";

import { cn } from "@/shared/utils/cn";

export default function Tooltip({ text, children, position = "top", color, className }) {
  const posClass = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  }[position];

  const bgStyle = color ? { backgroundColor: color } : {};

  return (
    <div className={cn("relative inline-flex group/tt", className)}>
      {children}
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-max max-w-56 rounded-[6px] px-2 py-1",
          "text-[11px] leading-snug text-white whitespace-normal",
          "border border-border shadow-[0_6px_20px_-4px_rgba(0,0,0,0.5)]",
          "opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150",
          !color && "bg-[#1c1714]",
          posClass
        )}
        style={bgStyle}
      >
        {text}
      </div>
    </div>
  );
}
