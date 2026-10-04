"use client";

import { useEffect, useMemo, useState } from "react";
import { Stat, Button } from "@/shared/components/ui";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useToast } from "@/shared/components/Toast";

export default function ModelsPage() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/models");
      if (r.ok) setData(await r.json());
    })();
  }, []);

  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const p of data.providers) {
      if (onlyActive && !p.active) continue;
      const hay = `${p.name} ${p.id} ${(p.models || [])
        .map((m) => `${m.id} ${m.name || ""}`)
        .join(" ")}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) continue;
      map.set(p.id, p);
    }
    return [...map.values()].sort(
      (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)
    );
  }, [data, q, onlyActive]);

  const total = data?.providers.reduce((n, p) => n + p.models.length, 0) || 0;
  const activeModels =
    data?.providers.filter((p) => p.active).reduce((n, p) => n + p.models.length, 0) || 0;
  const shown = groups.reduce((n, p) => n + p.models.length, 0);

  async function copyId(id) {
    try {
      await navigator.clipboard.writeText(id);
      toast("success", "Tersalin", `Model id "${id}" disalin`);
    } catch {
      toast("error", "Gagal menyalin");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Model" value={total} meta="di seluruh katalog" icon="deployed_code" tone="text-primary" />
        <Stat label="Provider" value={data?.providers.length ?? "…"} meta="terdaftar" icon="dns" />
        <Stat label="Bisa dipakai" value={activeModels} meta="model aktif" icon="check_circle" tone="text-green-500" />
        <Stat label="Butuh key" value={total - activeModels} meta="model dormant" icon="hourglass_empty" />
      </div>

      {/* hint */}
      <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-border-subtle bg-surface p-4 shadow-[var(--shadow-soft)]">
        <span className="inline-flex items-center justify-center size-[34px] rounded-[10px] bg-primary/10 border border-primary/20 text-primary">
          <span className="material-symbols-outlined text-[19px]">info</span>
        </span>
        <div className="flex-1 min-w-[220px] text-sm">
          <b>Cara pakai:</b>{" "}
          <span className="text-text-muted">
            kirim id model persis (contoh{" "}
            <code className="font-mono text-brand-300">deepseek-v4-flash</code>) atau beri prefix{" "}
            <code className="font-mono text-brand-300">provider-</code>. Body request tidak pernah
            di-strip.
          </span>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-subtle pointer-events-none">
            search
          </span>
          <input
            data-search
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari model / provider  ( / )"
            className="w-full rounded-[10px] border border-border bg-surface pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(229,106,74,.18)] transition-all"
          />
        </div>
        <button
          onClick={() => setOnlyActive((v) => !v)}
          className={`inline-flex items-center gap-2 h-[42px] px-4 rounded-[10px] border text-[13px] font-semibold transition-all ${
            onlyActive
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-surface text-text-muted hover:text-text-main"
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">filter_alt</span>
          Hanya terhubung
        </button>
      </div>

      {/* grid */}
      {!data ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-[10px] bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : shown === 0 ? (
        <div className="flex flex-col items-center gap-2.5 py-14 text-center">
          <span className="material-symbols-outlined text-[42px] text-text-subtle opacity-50">
            search_off
          </span>
          <div className="font-semibold">Tidak ada yang cocok</div>
          <div className="text-xs text-text-muted max-w-[340px]">
            Coba kata kunci lain — mis. &quot;claude&quot;, &quot;glm&quot;, atau nama provider.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((p) => (
            <section key={p.id} data-group>
              <div className="flex items-center gap-2.5 mb-3">
                <ProviderIcon providerId={p.id} size={20} alt={p.name} fallbackText={p.name[0]} />
                <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                  {p.name}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-border bg-surface-2 text-text-muted">
                  {p.models.length}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    p.active
                      ? "border-green-500/25 bg-green-500/10 text-green-500"
                      : "border-amber-500/25 bg-amber-500/10 text-amber-500"
                  }`}
                >
                  {p.active ? "terhubung" : "butuh key"}
                </span>
                <span className="flex-1 h-px bg-border-subtle" />
              </div>

              <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {p.models.map((m) => (
                  <div
                    key={p.id + m.id}
                    data-match={`${m.id} ${m.name || ""} ${p.name}`}
                    className={`group flex items-center gap-3 rounded-[10px] border border-border-subtle bg-surface px-3 py-2.5 transition-all hover:border-primary/45 hover:shadow-[var(--shadow-warm)] hover:-translate-y-px min-w-0 ${
                      p.active ? "" : "opacity-60"
                    }`}
                  >
                    <ProviderIcon
                      providerId={p.id}
                      size={30}
                      alt={p.name}
                      fallbackText={p.name[0]}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate" title={m.id}>
                        {m.name || m.id}
                      </div>
                      <div className="text-[11.5px] text-text-muted truncate flex items-center gap-1.5">
                        <span className="font-mono">{m.id}</span>
                        {!p.active && (
                          <b className="text-amber-500 font-semibold">belum terhubung</b>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => copyId(m.id)}
                      title="Salin id model"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-muted hover:bg-surface-2 hover:text-primary transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        content_copy
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
