"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Stat, Pill } from "@/shared/components/ui";

export default function LogsPage() {
  const [s, setS] = useState(null);
  const [live, setLive] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const boxRef = useRef(null);
  const seenRef = useRef(new Set());

  async function load() {
    const r = await fetch("/api/stats");
    if (!r.ok) return;
    const d = await r.json();
    setS(d);
  }

  useEffect(() => {
    load();
    if (!live) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [live]);

  useEffect(() => {
    if (autoScroll && boxRef.current) boxRef.current.scrollTop = 0;
  }, [s?.recent?.length, autoScroll]);

  const recent = s?.recent || [];
  const errCount = s ? s.requests - s.ok : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Total" value={(s?.requests ?? 0).toLocaleString()} meta="request tercatat" icon="terminal" tone="text-primary" />
        <Stat label="Sukses" value={(s?.ok ?? 0).toLocaleString()} meta="status ok" icon="check_circle" tone="text-green-500" />
        <Stat label="Gagal" value={errCount.toLocaleString()} meta="error / upstream" icon="error" tone={errCount ? "text-red-500" : ""} />
        <Stat label="Menampilkan" value={recent.length} meta="baris terakhir" icon="manage_search" />
      </div>

      <Card
        title="Request log"
        sub={live ? "auto-refresh tiap 3 detik" : "klik muat ulang / nyalakan live"}
        icon="terminal"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLive((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border text-xs font-semibold transition-all ${
                live
                  ? "border-green-500/30 bg-green-500/10 text-green-500"
                  : "border-border bg-surface-2 text-text-muted"
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-current"
                style={live ? { animation: "xrPulse 1.6s ease-in-out infinite" } : undefined}
              />
              {live ? "LIVE" : "PAUSED"}
            </button>
            <button
              onClick={() => setAutoScroll((v) => !v)}
              className={`h-7 px-3 rounded-lg border text-xs font-semibold transition-all ${
                autoScroll
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-surface-2 text-text-muted"
              }`}
              title="Tempel ke atas"
            >
              auto-scroll
            </button>
            <button
              onClick={load}
              className="h-7 w-7 grid place-items-center rounded-lg border border-border bg-surface-2 text-text-muted hover:text-primary transition-all"
              title="Muat ulang"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
            </button>
          </div>
        }
      >
        <style>{`@keyframes xrPulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
        {!recent.length ? (
          <div className="flex flex-col items-center gap-2.5 py-10 text-center">
            <span className="material-symbols-outlined text-[42px] text-text-subtle opacity-50">
              terminal
            </span>
            <div className="font-semibold">Log kosong</div>
            <div className="text-xs text-text-muted max-w-[340px]">
              Setiap request /v1 yang lewat gateway muncul di sini.
            </div>
          </div>
        ) : (
          <div ref={boxRef} className="overflow-x-auto -mx-1 px-1 max-h-[62vh] overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-surface z-10">
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-subtle">
                  <th className="pb-2.5 px-3 font-semibold">Waktu</th>
                  <th className="pb-2.5 px-3 font-semibold">Status</th>
                  <th className="pb-2.5 px-3 font-semibold">Model</th>
                  <th className="pb-2.5 px-3 font-semibold">Provider</th>
                  <th className="pb-2.5 px-3 font-semibold">Endpoint</th>
                  <th className="pb-2.5 px-3 font-semibold text-right">Latency</th>
                  <th className="pb-2.5 px-3 font-semibold text-right">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => {
                  const ok = r.status === "ok";
                  const ts = r.timestamp || "";
                  const time = ts.includes("T") ? ts.split("T")[1].replace("Z", "") : ts;
                  return (
                    <tr
                      key={`${ts}-${i}`}
                      className="border-t border-border-subtle hover:bg-surface-2/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-text-muted text-xs whitespace-nowrap">
                        {time}
                      </td>
                      <td className="px-3 py-2">
                        <Pill tone={ok ? "on" : "off"}>{r.status}</Pill>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.model || "-"}</td>
                      <td className="px-3 py-2 text-text-muted">{r.provider || "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs text-text-muted">{r.endpoint || "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.latencyMs} ms</td>
                      <td className="px-3 py-2 text-right tabular-nums text-text-muted">
                        {r.promptTokens}+{r.completionTokens}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
