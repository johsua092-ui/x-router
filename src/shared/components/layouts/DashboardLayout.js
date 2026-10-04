"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useNotificationStore } from "@/store/notificationStore";
import LeftRail from "../LeftRail";
import MobileNav from "../MobileNav";
import PageHeading from "../PageHeading";
import StatusBar from "../StatusBar";
import WelcomeModal from "../WelcomeModal";
import UpdateBanner from "../UpdateBanner";

/* Toast variants pull from the semantic token triplet, so the same toast is
   legible in Ember dark and in light without a dark: override per variant. */
function getToastStyle(type) {
  if (type === "success") {
    return { wrapper: "border-success/40 bg-success/12 text-success", icon: "check_circle" };
  }
  if (type === "error") {
    return { wrapper: "border-danger/40 bg-danger/12 text-danger", icon: "error" };
  }
  if (type === "warning") {
    return { wrapper: "border-warning/40 bg-warning/12 text-warning", icon: "warning" };
  }
  return { wrapper: "border-border bg-surface text-text-main", icon: "info" };
}

/* Pages that render their own hero / heading block, so the layout heading band
   would duplicate them. Keyed by the exact pathname or a prefix. */
const PAGES_WITH_OWN_HEADING = [
  "/dashboard/basic-chat",
  "/dashboard/providers/new",
  "/dashboard/plugins",
  "/dashboard/api-key-usage",
  "/dashboard/translator",
];

function hasOwnHeading(pathname) {
  if (!pathname) return false;
  if (PAGES_WITH_OWN_HEADING.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Provider / media-provider detail pages draw their own hero with the logo.
  if (/^\/dashboard\/providers\/[^/]+$/.test(pathname)) return true;
  if (/^\/dashboard\/media-providers\/[^/]+\/[^/]+$/.test(pathname)) return true;
  if (/^\/dashboard\/cli-tools\/[^/]+$/.test(pathname)) return true;
  return false;
}

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  // Preload heavy usage charts in background when browser is idle
  useEffect(() => {
    const preload = () => {
      import("@/shared/components/UsageStats").catch(() => {});
      import("@/app/(dashboard)/dashboard/usage/components/UsageChart").catch(() => {});
      import("@/app/(dashboard)/dashboard/usage/components/ProviderBarChart").catch(() => {});
      import("@/app/(dashboard)/dashboard/usage/components/TopModelsChart").catch(() => {});
    };
    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(preload, { timeout: 4000 });
        return () => window.cancelIdleCallback(id);
      }
      const timer = setTimeout(preload, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const isChat = pathname === "/dashboard/basic-chat";
  const showHeading = !hasOwnHeading(pathname);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[80] flex w-[min(92vw,380px)] flex-col gap-2">
        {notifications.map((n) => {
          const style = getToastStyle(n.type);
          return (
            <div
              key={n.id}
              role="status"
              className={`slide-in-right rounded-[6px] border px-3.5 py-2.5 shadow-[var(--shadow-elev)] ${style.wrapper}`}
            >
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px] leading-5">{style.icon}</span>
                <div className="min-w-0 flex-1">
                  {n.title ? <p className="mb-0.5 text-xs font-semibold">{n.title}</p> : null}
                  <p className="whitespace-pre-wrap break-words text-xs">{n.message}</p>
                </div>
                {n.dismissible ? (
                  <button
                    type="button"
                    onClick={() => removeNotification(n.id)}
                    className="opacity-70 transition-opacity hover:opacity-100"
                    aria-label="Dismiss notification"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <WelcomeModal />

      {/* Left-docked navigation (desktop) */}
      <LeftRail />

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <UpdateBanner />

        <main className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="ember-veil pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
          {showHeading ? <PageHeading className="shrink-0" /> : null}
          <div
            className={
              isChat
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "min-h-0 flex-1 overflow-y-auto custom-scrollbar"
            }
          >
            <div className={isChat ? "flex h-full w-full flex-col" : "w-full px-4 py-5 lg:px-8 lg:py-6"}>
              {children}
            </div>
          </div>
        </main>

        {/* Instrument status strip */}
        <StatusBar />
      </div>

      {/* Floating sheet (mobile) */}
      <MobileNav />
    </div>
  );
}
