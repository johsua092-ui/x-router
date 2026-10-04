"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const cn = (...a) => a.filter(Boolean).join(" ");

const navItems = [
  { href: "/dashboard", label: "Endpoint & Key", icon: "api" },
  { href: "/providers", label: "Providers", icon: "dns" },
  { href: "/models", label: "Models", icon: "deployed_code" },
  { href: "/usage", label: "Usage", icon: "bar_chart" },
  { href: "/logs", label: "Console Log", icon: "terminal" },
];

const systemItems = [
  { href: "/settings", label: "Settings", icon: "settings" },
];

function NavLink({ href, icon, label, active, onClick, sub = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 items-center gap-3 rounded-[10px] transition-all group",
        sub ? "pl-7 pr-3 py-[6px]" : "px-3 py-[7px]",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-text-muted hover:bg-surface-2 hover:text-text-main"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
      )}
      <span
        className={cn(
          "material-symbols-outlined shrink-0 leading-none",
          sub ? "size-4 text-[16px]" : "size-[18px] text-[18px]",
          active ? "fill-1 text-primary" : "group-hover:text-primary transition-colors"
        )}
      >
        {icon}
      </span>
      <span className="text-[13px] font-medium leading-none min-w-0 truncate" title={label}>
        {label}
      </span>
    </Link>
  );
}

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const isActive = (href) =>
    href === "/dashboard" ? pathname === "/dashboard" || pathname === "/"
      : pathname.startsWith(href);

  return (
    <aside className="flex w-72 flex-col border-r border-border-subtle bg-vibrancy backdrop-blur-xl transition-colors duration-300 min-h-full">
      {/* Logo — caduceus milik kita */}
      <div className="px-6 py-4 flex flex-col gap-2">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="X Router"
            className="size-9 rounded-[10px] shadow-[var(--shadow-warm)]"
          />
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight text-text-main">
              X<span className="text-primary">Router</span>
            </h1>
            <span className="text-xs text-text-muted">v0.2.0 · LLM gateway</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(item.href)}
            onClick={onClose}
          />
        ))}

        <div className="pt-3 mt-2 space-y-0.5">
          <p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">
            System
          </p>
          {systemItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(item.href)}
              onClick={onClose}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle">
        <a
          href="/logout"
          className="relative flex items-center gap-3 rounded-[10px] px-3 py-[7px] text-text-muted hover:bg-surface-2 hover:text-text-main transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="text-[13px] font-medium">Keluar</span>
        </a>
      </div>
    </aside>
  );
}
