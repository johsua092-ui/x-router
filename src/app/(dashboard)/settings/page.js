"use client";

import { useEffect, useState } from "react";
import { Card, Stat, Button, Field } from "@/shared/components/ui";
import { useToast } from "@/shared/components/Toast";
import { useTheme } from "@/shared/components/ThemeProvider";

export default function SettingsPage() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [s, setS] = useState(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.ok && r.json()).then(setS);
  }, []);

  async function changePw(e) {
    e.preventDefault();
    if (pw.length < 6) {
      toast("error", "Terlalu pendek", "Password minimal 6 karakter");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (r.ok) {
      toast("success", "Password diganti", "Sesi lama dibuang — login ulang");
      setPw("");
    } else toast("error", "Gagal mengganti password");
  }

  async function backup() {
    const r = await fetch("/api/settings/backup", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) toast("success", "Backup dibuat", d.file);
    else toast("error", "Backup gagal", d.error);
  }

  async function clearLogs() {
    if (!confirm("Semua baris usageHistory dihapus. API key, koneksi & registry tetap aman. Lanjut?"))
      return;
    const r = await fetch("/api/settings/clear-logs", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      toast("success", "Log dibersihkan", `${d.deleted} baris dihapus`);
      fetch("/api/stats").then((x) => x.ok && x.json()).then(setS);
    } else toast("error", "Gagal", d.error);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Katalog" value={s?.catalog?.providers ?? "…"} meta="provider tersedia" icon="cloud" />
        <Stat label="Model" value={s?.catalog?.models ?? "…"} meta="di katalog" icon="deployed_code" />
        <Stat label="API keys" value={s?.keys ?? "…"} meta="terdaftar" icon="key" />
        <Stat
          label="Total token"
          value={(s?.tokens ?? 0).toLocaleString()}
          meta={`${(s?.requests ?? 0).toLocaleString()} request`}
          icon="data_usage"
          tone="text-primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Tema" sub="terang / gelap · tekan G" icon="palette">
          <div className="flex gap-2.5 flex-wrap">
            <Button icon="dark_mode" onClick={() => setTheme("dark")} className={theme === "dark" ? "!border-primary/50 !text-primary" : ""}>
              Gelap
            </Button>
            <Button icon="light_mode" onClick={() => setTheme("light")} className={theme === "light" ? "!border-primary/50 !text-primary" : ""}>
              Terang
            </Button>
          </div>

          <div className="h-px bg-border-subtle my-4" />

          <div className="text-sm font-semibold mb-2">Ganti password</div>
          <form onSubmit={changePw} className="flex flex-col gap-3">
            <Field label="Password baru" hint="minimal 6 karakter · sesi lama dibuang">
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-[10px] border border-border bg-bg-alt px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all"
              />
            </Field>
            <Button type="submit" variant="primary" icon="save" disabled={busy}>
              {busy ? "Menyimpan..." : "Simpan password"}
            </Button>
          </form>
        </Card>

        <Card
          title="Gateway"
          sub="info runtime"
          icon="info"
          action={<Pill>running</Pill>}
        >
          <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2.5 text-[13px]">
            <dt className="text-text-muted">Versi</dt>
            <dd className="font-medium">x-router 0.2.0</dd>
            <dt className="text-text-muted">Engine</dt>
            <dd className="font-medium">Next.js 14 · node:sqlite</dd>
            <dt className="text-text-muted">Base URL</dt>
            <dd className="font-mono text-xs break-all">{typeof window !== "undefined" ? window.location.origin : ""}</dd>
            <dt className="text-text-muted">Provider</dt>
            <dd className="font-medium">
              {s?.catalog?.providers ?? "-"} di katalog · {s?.catalog?.activeProviders ?? 0} koneksi aktif
            </dd>
            <dt className="text-text-muted">Database</dt>
            <dd className="font-mono text-xs">data/xrouter.db (SQLite WAL)</dd>
            <dt className="text-text-muted">Login</dt>
            <dd className="font-medium">password-only · pbkdf2-sha256</dd>
          </dl>

          <div className="h-px bg-border-subtle my-4" />

          <div className="text-sm font-semibold mb-2.5">Maintenance</div>
          <div className="flex gap-2.5 flex-wrap">
            <Button icon="save" onClick={backup}>Backup DB</Button>
            <Button variant="danger" icon="delete_sweep" onClick={clearLogs}>
              Bersihkan log
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Data 30 hari" sub="request & token per hari" icon="database">
        {!s?.daily?.length ? (
          <div className="text-sm text-text-muted py-6 text-center">Belum ada data</div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-subtle">
                  <th className="pb-2.5 px-3 font-semibold">Hari</th>
                  <th className="pb-2.5 px-3 font-semibold text-right">Request</th>
                  <th className="pb-2.5 px-3 font-semibold text-right">Prompt</th>
                  <th className="pb-2.5 px-3 font-semibold text-right">Completion</th>
                  <th className="pb-2.5 px-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {[...s.daily].reverse().map((r) => (
                  <tr key={r.day} className="border-t border-border-subtle hover:bg-surface-2/50 transition-colors">
                    <td className="px-3 py-2 font-mono">{r.day}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.reqs}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.pt.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.ct.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {(r.pt + r.ct).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
