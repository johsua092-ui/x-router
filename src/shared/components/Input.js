"use client";

import { cn } from "@/shared/utils/cn";

/* One field treatment for every form control (see .field-control in globals.css).
   Label sits above in a micro-weight; hint and error occupy the same slot so
   nothing jumps when validation fires. */
export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  className,
  inputClassName,
  ...props
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-xs font-medium text-text-muted">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-subtle">
            <span className="material-symbols-outlined text-[18px] leading-none">{icon}</span>
          </div>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "field-control w-full h-9 px-3 text-[13px]",
            // iOS zoom fix — must stay >=16px on touch
            "text-[16px] sm:text-[13px]",
            icon && "pl-9",
            error && "!border-danger-border !shadow-none",
            inputClassName
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs text-danger-fg flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px] leading-none">error</span>
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}
