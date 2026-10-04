"use client";

import { useEffect } from "react";
import { cn } from "@/shared/utils/cn";
import Button from "./Button";

/* Modal. Solid panel, single ember rule under the header, no traffic lights —
   the close affordance is one labelled button instead of three decorative
   dots. showTrafficLights is kept as an accepted prop so existing call sites
   keep working. */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  className,
}) {
  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full flex flex-col bg-surface border border-border rounded-[6px]",
          "shadow-[var(--shadow-elev)] modal-in",
          "max-h-[calc(100vh-2rem)]",
          sizes[size],
          className
        )}
      >
        <div className="relative shrink-0 px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-4">
            {title ? (
              <h2 className="text-[15px] font-semibold tracking-tight text-text-main min-w-0">
                {title}
              </h2>
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

        <div className="px-5 py-4 overflow-y-auto custom-scrollbar">{children}</div>

        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border-subtle bg-bg-alt rounded-b-[12px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-text-muted leading-relaxed">{message}</p>
    </Modal>
  );
}
