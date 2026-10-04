"use client";

import { useEffect } from "react";
import { cn } from "@/shared/utils/cn";

export default function Drawer({ isOpen, onClose, title, children, width = "md", className }) {
  const widths = {
    sm: "w-full sm:w-[400px]",
    md: "w-full sm:w-[500px]",
    lg: "w-full sm:w-[600px]",
    xl: "w-full sm:w-[800px]",
    full: "w-full",
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/70 fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute right-0 top-0 h-full flex flex-col bg-surface border-l border-border",
          "shadow-[var(--shadow-elev)] slide-in-right",
          widths[width] || widths.md,
          className
        )}
      >
        <div className="relative shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-4">
            {title ? (
              <h2 className="text-[15px] font-semibold tracking-tight text-text-main">{title}</h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-0.5 -mr-1 shrink-0 p-1.5 rounded-[6px] text-text-subtle hover:bg-surface-2 hover:text-text-main transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">close</span>
            </button>
          </div>
          <span className="ember-rule mt-3" aria-hidden="true" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}
