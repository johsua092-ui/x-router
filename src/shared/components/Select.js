"use client";

import { cn } from "@/shared/utils/cn";

export default function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  error,
  hint,
  disabled = false,
  required = false,
  className,
  selectClassName,
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
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "field-control w-full h-9 pl-3 pr-9 text-[13px] appearance-none cursor-pointer",
            "text-[16px] sm:text-[13px]",
            error && "!border-danger-border !shadow-none",
            selectClassName
          )}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-text-subtle">
          <span className="material-symbols-outlined text-[18px] leading-none">expand_more</span>
        </div>
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
