"use client";

import { useEffect, useState } from "react";
import { Card, Stat, Button, Field, Pill } from "@/shared/components/ui";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useToast } from "@/shared/components/Toast";

export default function ProvidersPage() {
  const { toast } = useToast();
  const [cat, setCat] = useState(null);
  const [conns, setConns] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  // form tambah
  const [form, setForm] = useState({ provider: "", apiKey: "", baseUrl: "" });

  async function load() {
    const [m, c] = await Promise.all([fetch("/api/models"), fetch("/api/providers")]);
    if (m.ok) setCat((await m.json()).providers);
    if (c.ok) setConns((await c.json()).connections);
  }
  useEffect(() => { load(); }, []);

  const connectedIds = new Set((conns || []).map((c) => c.provider));
  const catalog =
    cat?.filter((p) => {
      if (q && !`${p.name} ${p.id}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }) || [];

  async function addConn(e) {
    e.preventDefault();
    if (!form.provider || !form.apiKey) return;
    setBusy(true);
    const r = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) {
      toast("success", "Provider terhubung", form.provider);
      setForm({ provider: "", apiKey: "", baseUrl: "" });
      load();
    } else toast("error", "Gagal", d.error);
  }

  async function removeConn(id, name) {
    if (!confirm(`Hapus koneksi ${name}? Model provider ini jadi dormant.`)) return;
    const r = await fetch("/api/providers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (r.ok) {
      toast("success", "Koneksi dihapus");
      load();
    } else toast("error", "Gagal menghapus");
  }

  const freePool = catalog.filter((p) => !connectedIds.has(p.id) && p.category !== "webCookie");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Terhubung" value={connectedIds.size} meta="provider aktif" icon="dns" tone="text-primary" />
        <Stat label="Koneksi" value={conns?.length ?? "…"} meta="total akun upstream" icon="hub" />
        <Stat label="Katalog" value={cat?.length ?? "…"} meta="provider tersedia" icon="cloud" />
        <Stat
          label="Model"
          value={cat?.reduce((n, p) => n + p.models.length, 0) ?? "…"}
          meta="siap dirutekan"
          icon="deployed_code"
        />
      </div>

      {/* koneksi aktif */}
      <Card
        title="Koneksi aktif"
        sub={conns ? `${conns.length} akun upstream` : "memuat..."}
        icon="hub"
        action={
          <div className="relative w-[min(56vw,260px)]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-text-subtle pointer-events-none">
              search
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari provider  ( / )"
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
        }
      >
        {!conns ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 rounded-[10px] bg-surface-2 animate-pulse" />
            ))}
          </div>
        ) : conns.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-10 text-center">
            <span className="material-symbols-outlined text-[42px] text-text-subtle opacity-50">
              cloud_off
            </span>
            <div className="font-semibold">Belum ada provider terhubung</div>
            <div className="text-xs text-text-muted max-w-[360px]">
              Tambah koneksi API key di bawah — model dari provider itu langsung muncul di halaman
              Models.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {conns.map((c) => {
              const p = cat?.find((x) => x.id === c.provider);
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-[10px] border border-border-subtle bg-surface px-4 py-3 transition-all hover:border-primary/35 hover:shadow-[var(--shadow-warm)]"
                >
                  <ProviderIcon providerId={c.provider} size={34} alt={c.provider} fallbackText={c.provider[0]} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{p?.name || c.provider}</div>
                    <div className="text-[11.5px] text-text-subtle font-mono truncate">
                      {c.baseUrl || p?.baseUrl || "-"} · key {c.keyMasked}
                    </div>
                  </div>
                  <Pill tone={c.isActive ? "on" : "off"}>{c.isActive ? "aktif" : "nonaktif"}</Pill>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    icon="delete"
                    onClick={() => removeConn(c.id, p?.name || c.provider)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* form tambah */}
      <Card title="Tambah koneksi" sub={`${freePool.length} provider katalog siap dihubungkan`} icon="add_circle">
        <form onSubmit={addConn} className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4 items-end">
          <Field label="Provider">
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              required
              className="w-full rounded-[10px] border border-border bg-bg-alt px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all appearance-none pr-8"
            >
              <option value="">— pilih provider —</option>
              {freePool.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.models.length} model)
                </option>
              ))}
            </select>
          </Field>
          <Field label="API Key">
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
              autoComplete="off"
              required
              className="w-full rounded-[10px] border border-border bg-bg-alt px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-brand-500 transition-all"
            />
          </Field>
          <Field label="Base URL override" hint="opsional">
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-[10px] border border-border bg-bg-alt px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-brand-500 transition-all"
            />
          </Field>
          <Button type="submit" variant="primary" icon={busy ? "progress_activity" : "add"} disabled={busy}>
            {busy ? "Menghubungkan..." : "Hubungkan"}
          </Button>
        </form>
      </Card>

      {/* katalog dengan foto */}
      <Card
        title="Katalog provider"
        sub={`${catalog.length} provider · klik untuk hubungkan`}
        icon="apps"
      >
        <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {catalog.map((p) => {
            const on = connectedIds.has(p.id);
            return (
              <div
                key={p.id}
                className={`group flex items-center gap-3 rounded-[10px] border border-border-subtle bg-surface px-3 py-2.5 transition-all hover:border-primary/45 hover:-translate-y-px min-w-0 ${
                  on ? "" : "opacity-75 hover:opacity-100"
                }`}
              >
                <ProviderIcon providerId={p.id} size={34} alt={p.name} fallbackText={p.name[0]} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate">{p.name}</div>
                  <div className="text-[11.5px] text-text-muted truncate">
                    {p.models.length} model · {p.category}
                  </div>
                </div>
                {on ? (
                  <Pill tone="on">aktif</Pill>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    icon="add"
                    onClick={() => {
                      setForm({ ...form, provider: p.id });
                      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                    }}
                  >
                    Hubungkan
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
