"use client";

import { useEffect, useState } from "react";
import { APP_CONFIG } from "@/shared/constants/config";

/* Status strip along the bottom of the shell — the instrument-panel tell that
   the upstream template does not have. Reports gateway health, the endpoint
   host, and the build, in mono type, always visible while you work. */

function Dot({ state }) {
  const color =
    state === "ok" ? "bg-success" : state === "down" ? "bg-danger" : "bg-warning";
  return (
    <span className="relative flex size-2 shrink-0">
      {state === "ok" && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
      )}
      <span className={`relative inline-flex size-2 rounded-full ${color}`} />
    </span>
  );
}

export default function StatusBar() {
  const [health, setHealth] = useState("checking");
  const [host, setHost] = useState("");

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (alive) setHealth(res.ok ? "ok" : "down");
      } catch {
        if (alive) setHealth("down");
      }
    };
    check();
    if (typeof window !== "undefined") setHost(window.location.host);
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const label = health === "ok" ? "Gateway online" : health === "down" ? "Gateway unreachable" : "Checking gateway";

  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-surface px-3 font-mono text-[10.5px] text-text-subtle lg:px-5">
      <span className="flex items-center gap-1.5">
        <Dot state={health} />
        <span className={health === "down" ? "text-danger-fg" : "text-text-muted"}>{label}</span>
      </span>

      <span className="hidden items-center gap-1.5 sm:flex">
        <span className="material-symbols-outlined text-[12px] leading-none text-text-subtle">api</span>
        <span className="truncate">{host || "localhost"}</span>
      </span>

      <span className="ml-auto hidden items-center gap-1.5 md:flex">
        <span className="material-symbols-outlined text-[12px] leading-none text-text-subtle">bolt</span>
        <span>OpenAI · Anthropic compatible</span>
      </span>

      <span className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[12px] leading-none text-brand-500">local_fire_department</span>
        <span className="tabular-nums">{APP_CONFIG.name} v{APP_CONFIG.version}</span>
      </span>
    </div>
  );
}
