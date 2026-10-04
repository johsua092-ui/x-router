"use client";

import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import useSettingsStore from "@/store/settingsStore";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import HeaderMenu from "@/shared/components/HeaderMenu";

/* Command rail. Two tiers: a brand/utility bar, then a tab strip of sections.
   This is the deliberate break from the upstream template — navigation is a
   horizontal instrument strip, not a left column, and the active section is
   marked by an ember underline rather than a filled sidebar row. */

const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt", "systemone"];
const COMBINED_WEB_ITEM = {
  id: "web",
  label: "Web Fetch & Search",
  icon: "travel_explore",
  href: "/dashboard/media-providers/web",
};

const navItems = [
  { href: "/dashboard/endpoint", label: "Endpoint", icon: "api" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  { href: "/dashboard/combos", label: "Combos", icon: "layers" },
  { href: "/dashboard/usage", label: "Usage", icon: "bar_chart" },
  { href: "/dashboard/quota", label: "Quota", icon: "data_usage" },
  { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
];

const workshopItems = [
  { href: "/dashboard/arena", label: "Compare Models", icon: "swords" },
  { href: "/dashboard/model-editor", label: "Custom Models", icon: "auto_awesome" },
  { href: "/dashboard/plugins", label: "Custom Plugins", icon: "widgets" },
  { href: "/dashboard/prd-builder", label: "PRD Builder", icon: "description" },
];

const debugItems = [
  { href: "/dashboard/console-log", label: "Console Log", icon: "monitor" },
  { href: "/dashboard/translator", label: "Translator", icon: "translate" },
];

const systemItems = [{ href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" }];

/* ---- tab ------------------------------------------------------------- */

function Tab({ href, icon, label, active, onClick, badge = null }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      className={cn(
        "relative flex h-full shrink-0 items-center gap-2 px-3 text-[12.5px] transition-colors duration-150",
        active ? "text-text-main" : "text-text-muted hover:text-text-main hover:bg-surface-2"
      )}
    >
      <span
        className={cn(
          "material-symbols-outlined shrink-0 text-[16px] leading-none",
          active ? "text-primary" : "text-text-subtle"
        )}
      >
        {icon}
      </span>
      <span className={cn("whitespace-nowrap leading-none", active && "font-semibold")}>{label}</span>
      {badge}
      {/* Active section is marked by an ember underline — the rail's signature. */}
      {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" aria-hidden="true" />}
    </Link>
  );
}

Tab.propTypes = {
  href: PropTypes.string.isRequired,
  icon: PropTypes.string,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func,
  badge: PropTypes.node,
};

function TabGroup({ label, icon, items, active, isActive, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative h-full shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          "relative flex h-full items-center gap-2 px-3 text-[12.5px] transition-colors duration-150",
          active || open ? "text-text-main" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
        )}
      >
        <span className={cn("material-symbols-outlined text-[16px] leading-none", active || open ? "text-primary" : "text-text-subtle")}>
          {icon}
        </span>
        <span className={cn("whitespace-nowrap leading-none", active && "font-semibold")}>{label}</span>
        <span
          className="material-symbols-outlined text-[14px] leading-none transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          expand_more
        </span>
        {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" aria-hidden="true" />}
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+1px)] z-50 min-w-[230px] border border-border bg-surface p-1.5 shadow-[var(--shadow-elev)] rounded-[8px]">
          {items
            ? items.map((item) => (
                <PanelLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={typeof isActive === "function" ? isActive(item.href) : false}
                  onClick={() => setOpen(false)}
                />
              ))
            : children}
        </div>
      )}
    </div>
  );
}

TabGroup.propTypes = {
  label: PropTypes.string.isRequired,
  icon: PropTypes.string,
  items: PropTypes.array,
  active: PropTypes.bool,
  isActive: PropTypes.func,
  children: PropTypes.node,
};

function PanelLink({ href, icon, label, active, onClick, badge = null }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={label}
      className={cn(
        "flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] transition-colors",
        active ? "bg-brand-500/12 text-text-main" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
      )}
    >
      <span className={cn("material-symbols-outlined shrink-0 text-[16px] leading-none", active && "text-primary")}>
        {icon}
      </span>
      <span className={cn("flex-1 truncate text-[12.5px] leading-none", active && "font-semibold")}>{label}</span>
      {badge}
    </Link>
  );
}

PanelLink.propTypes = {
  href: PropTypes.string.isRequired,
  icon: PropTypes.string,
  label: PropTypes.string.isRequired,
  active: PropTypes.bool,
  onClick: PropTypes.func,
  badge: PropTypes.node,
};

function RailSearch() {
  const visible = useHeaderSearchStore((s) => s.visible);
  const query = useHeaderSearchStore((s) => s.query);
  const placeholder = useHeaderSearchStore((s) => s.placeholder);
  const setQuery = useHeaderSearchStore((s) => s.setQuery);

  if (!visible) return null;

  return (
    <div className="relative hidden min-w-0 md:block md:w-[190px] xl:w-[260px]">
      <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">
        search
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-full rounded-[6px] border border-border bg-bg-alt pl-7 pr-7 text-[12.5px] focus:border-primary/50 focus:outline-none"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:text-text-main"
          aria-label="Clear search"
        >
          <span className="material-symbols-outlined text-[15px]">close</span>
        </button>
      )}
    </div>
  );
}

/* ---- rail ------------------------------------------------------------ */

export default function TopRail() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [enableTranslator, setEnableTranslator] = useState(false);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) window.location.assign("/login");
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  useEffect(() => {
    fetch("/api/auth/status")
      .then((res) => res.json())
      .then((data) => setAuthStatus(data))
      .catch(() => {});
  }, []);

  const isApiKeyUser = authStatus?.role === "apikey";
  const permissions = authStatus?.permissions || {
    manageApiKeys: true,
    manageModels: true,
    manageProviders: true,
    manageTools: true,
    manageAdvanced: true,
    managePlugins: true,
    manageMediaProviders: true,
    viewUsage: true,
  };

  useEffect(() => {
    if (isApiKeyUser) return;
    useSettingsStore
      .getState()
      .fetchSettings()
      .then((data) => {
        if (data?.enableTranslator) setEnableTranslator(true);
      });
  }, [isApiKeyUser]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href) => {
    if (href === "/dashboard/endpoint") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint");
    }
    return pathname.startsWith(href);
  };

  const filteredNavItems = navItems.filter((item) => {
    if (!isApiKeyUser) return true;
    if (item.href === "/dashboard/endpoint") return permissions.manageApiKeys;
    if (item.href === "/dashboard/providers") return permissions.manageProviders;
    if (item.href === "/dashboard/combos") return permissions.manageModels;
    if (item.href === "/dashboard/usage") return permissions.viewUsage;
    if (item.href === "/dashboard/quota") return permissions.manageProviders;
    if (item.href === "/dashboard/token-saver" || item.href === "/dashboard/cli-tools")
      return permissions.manageTools;
    return false;
  });

  const filteredWorkshopItems = workshopItems.filter((item) => {
    if (!isApiKeyUser) return true;
    if (
      item.href === "/dashboard/model-editor" ||
      item.href === "/dashboard/arena" ||
      item.href === "/dashboard/prd-builder"
    )
      return permissions.manageModels;
    if (item.href === "/dashboard/plugins") return permissions.managePlugins;
    return false;
  });

  const filteredDebugItems = debugItems.filter((item) => (isApiKeyUser ? permissions.manageAdvanced : true));
  const filteredSystemItems = systemItems.filter((item) => (isApiKeyUser ? permissions.manageAdvanced : true));

  const canOpenMedia = !isApiKeyUser || permissions.manageMediaProviders;
  const mediaActive = pathname.startsWith("/dashboard/media-providers");
  const hasMediaNew = MEDIA_PROVIDER_KINDS.some(
    (k) => VISIBLE_MEDIA_KINDS.includes(k.id) && k.isNew
  );

  const visibleDebugItems = filteredDebugItems.filter(
    (item) => item.href !== "/dashboard/translator" || enableTranslator
  );

  const workshopActive = filteredWorkshopItems.some((i) => isActive(i.href));
  const systemActive =
    mediaActive ||
    filteredSystemItems.some((i) => isActive(i.href)) ||
    visibleDebugItems.some((i) => isActive(i.href)) ||
    isActive("/dashboard/profile");

  const showSystemGroup =
    !isApiKeyUser || canOpenMedia || filteredSystemItems.length > 0 || visibleDebugItems.length > 0;

  const mobileSections = [
    { label: null, items: filteredNavItems },
    { label: "Feature+", items: filteredWorkshopItems },
    {
      label: "System",
      items: [
        ...(canOpenMedia
          ? [
              { href: "/dashboard/media-providers", label: "Media Providers", icon: "perm_media" },
              ...MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map((k) => ({
                href: `/dashboard/media-providers/${k.id}`,
                label: k.label,
                icon: k.icon,
              })),
              COMBINED_WEB_ITEM,
            ]
          : []),
        ...filteredSystemItems,
        ...visibleDebugItems,
        ...(isApiKeyUser ? [] : [{ href: "/dashboard/profile", label: "X Router Settings", icon: "settings" }]),
      ],
    },
  ];

  return (
    <header className="z-40 shrink-0 border-b border-border bg-surface">
      {/* Tier 1 — brand + utilities */}
      <div className="flex h-11 items-center gap-3 border-b border-border-subtle px-3 lg:px-5">
        <Link
          href="/dashboard"
          className="-m-1 flex shrink-0 items-center gap-2 rounded-[7px] p-1 transition-colors hover:bg-surface-2"
        >
          <span className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] ring-1 ring-brand-500/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="X Router" className="size-6 object-cover" />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold leading-none tracking-tight text-text-main">
              {APP_CONFIG.name}
            </span>
            <span className="font-mono text-[10px] leading-none tabular-nums text-text-subtle">
              v{APP_CONFIG.version}
            </span>
          </span>
        </Link>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5">
          {isApiKeyUser && (
            <span className="hidden items-center gap-1.5 rounded-[6px] border border-brand-500/25 bg-brand-500/12 px-2 py-1 text-[11px] font-medium text-primary xl:flex">
              <span className="material-symbols-outlined text-[13px] leading-none">key</span>
              <span className="max-w-[120px] truncate">{authStatus?.displayName || "API Key User"}</span>
            </span>
          )}
          <RailSearch />
          <a
            href="https://github.com/johsua092-ui/x-router"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center justify-center rounded-[6px] border border-border-subtle p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main sm:flex"
            title="GitHub Repository"
            aria-label="GitHub Repository"
          >
            <svg className="size-[15px] shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
          <HeaderMenu onLogout={handleLogout} />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="flex items-center justify-center rounded-[6px] p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main lg:hidden"
          >
            <span className="material-symbols-outlined text-[19px] leading-none">{mobileOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {/* Tier 2 — section tab strip */}
      <nav className="hidden h-9 items-stretch gap-0 overflow-x-auto px-1.5 lg:flex custom-scrollbar">
        {filteredNavItems.map((item) => (
          <Tab
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
          />
        ))}

        {filteredWorkshopItems.length > 0 && (
          <TabGroup
            label="Feature+"
            icon="auto_awesome_motion"
            items={filteredWorkshopItems}
            active={workshopActive}
            isActive={isActive}
          />
        )}

        {showSystemGroup && (
          <TabGroup label="System" icon="settings_suggest" active={systemActive}>
            <div className="flex max-h-[70vh] flex-col overflow-y-auto custom-scrollbar">
              {canOpenMedia && (
                <>
                  <div className="px-2.5 pb-1 pt-2">
                    <span className="micro-label">Media Providers</span>
                  </div>
                  {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map((kind) => (
                    <PanelLink
                      key={kind.id}
                      href={`/dashboard/media-providers/${kind.id}`}
                      icon={kind.icon}
                      label={kind.label}
                      active={pathname.startsWith(`/dashboard/media-providers/${kind.id}`)}
                    />
                  ))}
                  <PanelLink
                    href={COMBINED_WEB_ITEM.href}
                    icon={COMBINED_WEB_ITEM.icon}
                    label={COMBINED_WEB_ITEM.label}
                    active={pathname.startsWith(COMBINED_WEB_ITEM.href)}
                    badge={
                      hasMediaNew ? (
                        <span className="rounded-[3px] bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                          Baru
                        </span>
                      ) : null
                    }
                  />
                  <div className="my-1.5 h-px bg-border-subtle" aria-hidden="true" />
                </>
              )}
              {filteredSystemItems.map((item) => (
                <PanelLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.href)}
                />
              ))}
              {visibleDebugItems.map((item) => (
                <PanelLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.href)}
                />
              ))}
              {!isApiKeyUser && (
                <>
                  <div className="my-1.5 h-px bg-border-subtle" aria-hidden="true" />
                  <PanelLink
                    href="/dashboard/profile"
                    icon="settings"
                    label="X Router Settings"
                    active={isActive("/dashboard/profile")}
                  />
                </>
              )}
            </div>
          </TabGroup>
        )}
      </nav>

      {/* Mobile navigation sheet */}
      {mobileOpen && (
        <div className="fade-in max-h-[calc(100vh-2.75rem)] overflow-y-auto border-t border-border-subtle bg-surface px-2.5 py-2 lg:hidden custom-scrollbar">
          {mobileSections.map((section, si) => (
            <div key={section.label || `s${si}`}>
              {section.label && (
                <div className="flex items-center gap-2.5 px-2.5 pb-1 pt-3.5">
                  <span className="micro-label">{section.label}</span>
                  <span className="ember-rule-left flex-1 opacity-60" aria-hidden="true" />
                </div>
              )}
              {section.items.map((item) => (
                <PanelLink
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.href)}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

TopRail.propTypes = {};
