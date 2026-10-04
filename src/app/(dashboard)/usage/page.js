"use client";

import { useEffect, useState } from "react";
import { Card, Stat } from "@/shared/components/ui";

function BarChart({ rows }) {
  if (!rows?.length)
    return (
      <div className="flex flex-col items-center gap-2.5 py-10 text-center">
        <span className="material-symbols-outlined text-[42px] text-text-subtle opacity-50">
          monitoring
        </span>
        <div className="font-semibold">Belum ada data</div>
        <div className="text-xs text-text-muted">Chart muncul setelah ada request masuk.</div>
      </div>
    );
  const vals = rows.map((r) => r.pt + r.ct);
  const mx = Math.max(...vals, 1);
  return (
    <div className="flex items-end gap-1.5 h-32">
      {rows.map((r, i) => {
        const v = r.pt + r.ct;
        const pct = Math.max(2, Math.round((v / mx) * 100));
        return (
          <div
            key={r.day}
            className="flex-1 group relative rounded-t-md bg-gradient-to-t from-brand-700 to-brand-400 transition-all hover:brightness-125"
            style={{
              height: `${pct}%`,
              animation: `xrGrow .6s cubic-bezier(.2,.8,.3,1) ${i * 40}ms both`,
            }}
            title={`${r.day}: ${v.toLocaleString()} token`}
          >
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {v.toLocaleString()}
            </span>
          </div>
        );
      })}
      <style>{`@keyframes xrGrow{from{transform:scaleY(.1);opacity:.3}to{transform:scaleY(1);opacity:1}}`}</style>
    </div>
  );
}

function Spark({ values }) {
  if (!values || values.length < 2) return null;
  const w = 120, h = 34;
  const mx = Math.max(...values, 1);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - (v / mx) * (h - 6) - 3,
  ]);
  const d = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark">
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill="rgba(229,106,74,.14)" className="area" />
      <path
        d={d}
        fill="none"
        stroke="var(--color-brand-400)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function UsagePage() {
  const [s, setS] = useState(null);

  async function load() {
    const r = await fetch("/api/stats");
    if (r.ok) setS(await r.json());
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const errPct = s && s.requests ? Math.round(((s.requests - s.ok) / s.requests) * 1000) / 10 : 0;
  const sparkVals = (s?.recent || []).slice(0, 30).reverse().map((r) => r.promptTokens + r.completionTokens);
  const maxProv = Math.max(...(s?.providers || []).map((p) => p.reqs), 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Requests"
          value={(s?.requests ?? 0).toLocaleString()}
          meta={`${errPct}% error rate`}
          icon="swap_horiz"
          tone="text-primary"
          spark={sparkVals.length > 1 ? <Spark values={sparkVals} /> : null}
        />
        <Stat
          label="Tokens"
          value={(s?.tokens ?? 0).toLocaleString()}
          meta="prompt + completion"
          icon="data_usage"
          tone="text-green-500"
        />
        <Stat
          label="Latensi p95"
          value={`${(s?.latency?.p95 ?? 0).toLocaleString()} ms`}
          meta={`p50 ${s?.latency?.p50 ?? 0} ms · avg ${s?.latency?.avg ?? 0} ms`}
          icon="speed"
        />
        <Stat
          label="1 jam terakhir"
          value={s?.lastHour ?? 0}
          meta="request masuk"
          icon="schedule"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Token harian" sub="14 hari terakhir (UTC)" icon="monitoring">
          <BarChart rows={s?.daily || []} />
          <div className="flex justify-between text-[10px] text-text-subtle font-mono mt-2">
            {(s?.daily || []).map((r, i) => (
              <span key={r.day}>
                {i % Math.max(1, Math.ceil((s?.daily || []).length / 7)) === 0 ? r.day.slice(5) : ""}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Per provider" sub="distribusi request" icon="dns">
          {!s?.providers?.length ? (
            <div className="flex flex-col items-center gap-2.5 py-10 text-center">
              <span className="material-symbols-outlined text-[42px] text-text-subtle opacity-50">
                dns
              </span>
              <div className="font-semibold">Belum ada trafik per provider</div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {s.providers.map((p) => (
                <div key={p.provider}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-text-muted">{p.provider}</span>
                    <span className="font-semibold">
                      {p.reqs} req · {p.tokens.toLocaleString()} token · {p.ok} ok
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
                      style={{ width: `${Math.round((p.reqs / maxProv) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Model teratas" sub="berdasarkan jumlah request" icon="leaderboard">
        {!s?.topModels?.length ? (
          <div className="flex flex-col items-center gap-2.5 py-10 text-center">
            <span className="material-symbols-outlined text-[42px] text-text-subtle opacity-50">
              leaderboard
            </span>
            <div className="font-semibold">Belum ada request</div>
            <div className="text-xs text-text-muted">
              Leaderboard model terisi setelah gateway dipakai.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-subtle">
                  <th className="pb-2.5 px-3 font-semibold">Model</th>
                  <th className="pb-2.5 px-3 font-semibold">Provider</th>
                  <th className="pb-2.5 px-3 font-semibold">Req</th>
                  <th className="pb-2.5 px-3 font-semibold">Tokens</th>
                  <th className="pb-2.5 px-3 font-semibold">Avg</th>
                  <th className="pb-2.5 px-3 font-semibold w-44" />
                </tr>
              </thead>
              <tbody>
                {s.topModels.map((t, i) => {
                  const max = s.topModels[0].reqs || 1;
                  return (
                    <tr key={i} className="border-t border-border-subtle hover:bg-surface-2/50 transition-colors">
                      <td className="px-3 py-2.5 font-medium font-mono">{t.model}</td>
                      <td className="px-3 py-2.5 text-text-muted">{t.provider || "-"}</td>
                      <td className="px-3 py-2.5 tabular-nums">{t.reqs}</td>
                      <td className="px-3 py-2.5 tabular-nums">{t.tokens.toLocaleString()}</td>
                      <td className="px-3 py-2.5 tabular-nums text-text-muted">{t.avg_ms} ms</td>
                      <td className="px-3 py-2.5">
                        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                            style={{ width: `${Math.round((t.reqs / max) * 100)}%` }}
                          />
                        </div>
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
