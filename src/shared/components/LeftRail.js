"use client";

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import HeaderMenu from "@/shared/components/HeaderMenu";
import { useNavigation } from "@/shared/hooks/useNavigation";
import { MEDIA_ITEMS } from "@/shared/constants/navigation";

/* Suspended Studio Rail. Navigation is a floating, rounded instrument dock
   docked to the left edge with 10px margin. Can be compact (58px icon-only)
   or pinned/expanded (216px). Flyout sub-menus expand rightward into the canvas.
   Active item is marked with a glowing ember indicator. */

function RailRow({ href, icon, label, active, open, onClick, badge = null }) {
  const inner = (
    <>
      <span
        className={cn(
          "material-symbols-outlined shrink-0 text-[18px] leading-none transition-colors",
          active ? "text-primary font-semibold" : "text-text-subtle"
        )}
      >
        {icon}
      </span>
      {open && (
        <span className={cn("flex-1 truncate whitespace-nowrap text-[12.5px] leading-none", active ? "font-semibold text-text-main" : "text-text-muted")}>
          {label}
        </span>
      )}
      {open && badge}
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r bg-brand-500 shadow-[0_0_8px_rgba(229,106,74,0.6)]" aria-hidden="true" />
      )}
    </>
  );

  const cls = cn(
    "relative flex h-8.5 w-full items-center gap-2.5 rounded-[5px] transition-colors duration-150 cursor-pointer",
    open ? "px-2.5" : "justify-center px-0",
    active ? "bg-surface-2 text-text-main font-medium border border-border-subtle" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} title={label} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} className={cls}>
      {inner}
    </button>
  );
}

RailRow.propTypes = {
  href: PropTypes.string,
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  open: PropTypes.bool,
  onClick: PropTypes.func,
  badge: PropTypes.node,
};

function GroupRow({ icon, label, active, open, expanded, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-expanded={expanded}
      className={cn(
        "relative flex h-8.5 w-full items-center gap-2.5 rounded-[5px] transition-colors duration-150 cursor-pointer",
        open ? "px-2.5" : "justify-center px-0",
        active || expanded ? "bg-surface-2 text-text-main border border-border-subtle" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
      )}
    >
      <span
        className={cn(
          "material-symbols-outlined shrink-0 text-[18px] leading-none transition-colors",
          active || expanded ? "text-primary" : "text-text-subtle"
        )}
      >
        {icon}
      </span>
      {open && (
        <>
          <span className={cn("flex-1 truncate whitespace-nowrap text-left text-[12.5px] leading-none", active && "font-semibold")}>
            {label}
          </span>
          <span
            className="material-symbols-outlined text-[14px] leading-none text-text-subtle transition-transform duration-200"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            chevron_right
          </span>
        </>
      )}
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r bg-brand-500 shadow-[0_0_8px_rgba(229,106,74,0.6)]" aria-hidden="true" />
      )}
    </button>
  );
}

GroupRow.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  open: PropTypes.bool,
  expanded: PropTypes.bool,
  onClick: PropTypes.func,
};

function Flyout({ children }) {
  return (
    <div className="fade-in absolute left-full top-1 z-50 ml-2.5 w-[240px] rounded-[6px] border border-border bg-surface p-1.5 shadow-[var(--shadow-elev)]">
      {children}
    </div>
  );
}

Flyout.propTypes = { children: PropTypes.node };

export function FlyoutLink({ href, icon, label, active, onClick, badge = null }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      className={cn(
        "flex items-center gap-2 rounded-[4px] px-2.5 py-[6px] transition-colors",
        active ? "bg-brand-500/12 text-primary font-medium" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
      )}
    >
      <span className={cn("material-symbols-outlined shrink-0 text-[15px] leading-none", active && "text-primary")}>
        {icon}
      </span>
      <span className={cn("flex-1 truncate text-[12px] leading-none", active && "font-semibold")}>{label}</span>
      {badge}
    </Link>
  );
}

FlyoutLink.propTypes = {
  href: PropTypes.string.isRequired,
  icon: PropTypes.string,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func,
  badge: PropTypes.node,
};

export default function LeftRail() {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState(null);
  const railRef = useRef(null);

  const {
    navItems,
    workshopItems,
    debugItems,
    systemItems,
    canOpenMedia,
    showSystemGroup,
    isApiKeyUser,
    hasMediaNew,
    isActive,
  } = useNavigation();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("xrouter_left_rail_pinned");
      if (saved !== null) {
        setPinned(saved === "true");
      }
    } catch {}
  }, []);

  const handleTogglePin = () => {
    setPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("xrouter_left_rail_pinned", String(next));
      } catch {}
      return next;
    });
  };

  const open = hovered || pinned;

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) window.location.assign("/login");
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  useEffect(() => {
    setExpandedGroup(null);
    setHovered(false);
  }, [pathname]);

  useEffect(() => {
    if (!expandedGroup) return;
    const onDocClick = (e) => {
      if (railRef.current && !railRef.current.contains(e.target)) {
        setExpandedGroup(null);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [expandedGroup]);

  // Split nav items into core routing vs telemetry for clean visual hierarchy
  const coreRoutingHrefs = ["/dashboard/endpoint", "/dashboard/providers", "/dashboard/combos"];
  const coreRouting = navItems.filter((i) => coreRoutingHrefs.includes(i.href));
  const telemetry = navItems.filter((i) => !coreRoutingHrefs.includes(i.href));

  return (
    <aside
      ref={railRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setExpandedGroup(null);
      }}
      className={cn(
        "relative isolate hidden my-2.5 ml-2.5 h-[calc(100vh-20px)] flex-col rounded-[8px] border border-border bg-surface transition-[width] duration-200 ease-out select-none lg:flex z-30 shrink-0 shadow-lg overflow-hidden",
        open ? "w-[210px]" : "w-[56px]"
      )}
      aria-label="Application navigation"
    >
      {/* Brand header */}
      <div className="flex h-12 items-center justify-between border-b border-border px-2.5 shrink-0 bg-surface-2">
        <Link
          href="/dashboard/endpoint"
          className={cn(
            "flex items-center gap-2 overflow-hidden transition-opacity hover:opacity-90",
            !open && "w-full justify-center"
          )}
          title="X Router Dashboard"
        >
          <div className="size-7 rounded-[5px] border border-brand-500/40 bg-surface flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-primary text-[17px] leading-none">
              health_and_safety
            </span>
          </div>
          {open && (
            <div className="min-w-0 flex flex-col">
              <span className="text-[11.5px] font-bold tracking-wider uppercase text-text-main truncate">
                {APP_CONFIG.name}
              </span>
              <span className="text-[9.5px] font-mono text-text-muted truncate">
                v{APP_CONFIG.version}
              </span>
            </div>
          )}
        </Link>

        {open && (
          <button
            type="button"
            onClick={handleTogglePin}
            className="p-1 rounded text-text-muted hover:text-text-main hover:bg-surface transition-colors cursor-pointer"
            title={pinned ? "Collapse sidebar" : "Pin sidebar expanded"}
            aria-label={pinned ? "Collapse sidebar" : "Pin sidebar expanded"}
          >
            <span className="material-symbols-outlined text-[15px] leading-none">
              {pinned ? "view_sidebar" : "dock_to_left"}
            </span>
          </button>
        )}
      </div>

      {/* Main navigation list */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 custom-scrollbar space-y-3">
        {/* Core Routing */}
        <div className="space-y-0.5">
          {open && (
            <div className="px-2 pb-1 text-[9.5px] font-mono uppercase tracking-wider text-text-subtle">
              Routing
            </div>
          )}
          {coreRouting.map((item) => (
            <RailRow
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              open={open}
              onClick={() => setExpandedGroup(null)}
            />
          ))}
        </div>

        {/* Telemetry & Policies */}
        <div className="space-y-0.5 pt-1 border-t border-border-subtle">
          {open && (
            <div className="px-2 pb-1 text-[9.5px] font-mono uppercase tracking-wider text-text-subtle">
              Operations
            </div>
          )}
          {telemetry.map((item) => (
            <RailRow
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isActive(item.href)}
              open={open}
              onClick={() => setExpandedGroup(null)}
            />
          ))}
        </div>

        {/* Extensions & System */}
        <div className="space-y-0.5 pt-1 border-t border-border-subtle">
          {open && (
            <div className="px-2 pb-1 text-[9.5px] font-mono uppercase tracking-wider text-text-subtle">
              Extensions
            </div>
          )}
          {/* Feature+ Group */}
          <div className="relative">
            <GroupRow
              icon="auto_awesome"
              label="Features"
              active={workshopItems.some((i) => isActive(i.href))}
              open={open}
              expanded={expandedGroup === "workshop"}
              onClick={() => setExpandedGroup((prev) => (prev === "workshop" ? null : "workshop"))}
            />
            {expandedGroup === "workshop" && (
              <Flyout>
                <div className="mb-1 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted border-b border-border-subtle">
                  Studio & Tools
                </div>
                <div className="space-y-0.5">
                  {workshopItems.map((item) => (
                    <FlyoutLink
                      key={item.href}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      active={isActive(item.href)}
                      onClick={() => setExpandedGroup(null)}
                    />
                  ))}
                </div>
              </Flyout>
            )}
          </div>

          {/* System Group */}
          {showSystemGroup && (
            <div className="relative">
              <GroupRow
                icon="tune"
                label="System"
                active={
                  systemItems.some((i) => isActive(i.href)) ||
                  debugItems.some((i) => isActive(i.href)) ||
                  MEDIA_ITEMS.some((i) => isActive(i.href))
                }
                open={open}
                expanded={expandedGroup === "system"}
                onClick={() => setExpandedGroup((prev) => (prev === "system" ? null : "system"))}
              />
              {expandedGroup === "system" && (
                <Flyout>
                  <div className="mb-1 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted border-b border-border-subtle">
                    Infrastructure
                  </div>
                  <div className="max-h-[360px] overflow-y-auto space-y-0.5 custom-scrollbar">
                    {canOpenMedia && (
                      <div className="mb-1 pb-1 border-b border-border-subtle">
                        <div className="px-2.5 py-0.5 text-[9.5px] font-medium text-text-subtle uppercase">
                          Media Engines
                        </div>
                        {MEDIA_ITEMS.map((item) => (
                          <FlyoutLink
                            key={item.href}
                            href={item.href}
                            icon={item.icon}
                            label={item.label}
                            active={isActive(item.href)}
                            onClick={() => setExpandedGroup(null)}
                          />
                        ))}
                      </div>
                    )}

                    {debugItems.map((item) => (
                      <FlyoutLink
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        active={isActive(item.href)}
                        onClick={() => setExpandedGroup(null)}
                      />
                    ))}

                    {systemItems.map((item) => (
                      <FlyoutLink
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                        active={isActive(item.href)}
                        onClick={() => setExpandedGroup(null)}
                      />
                    ))}
                  </div>
                </Flyout>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer controls & user menu */}
      <div className="border-t border-border p-2 bg-surface-2 flex items-center justify-between gap-2 shrink-0">
        <div className={cn("flex items-center gap-2 min-w-0 overflow-hidden", !open && "w-full justify-center")}>
          <HeaderMenu onLogout={handleLogout} />
          {open && (
            <div className="min-w-0 flex flex-col">
              <span className="text-[11.5px] font-semibold text-text-main truncate">
                {isApiKeyUser ? "API Session" : "Instance Admin"}
              </span>
              <span className="text-[9.5px] text-success flex items-center gap-1 font-mono">
                <span className="size-1.5 rounded-full bg-success shrink-0" />
                Live 8080
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
