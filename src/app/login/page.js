"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        const d = await r.json().catch(() => ({}));
        setErr(d.error || "Password salah.");
      }
    } catch {
      setErr("Gagal terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg dot-grid-bg">
      <div className="w-[min(94vw,380px)] rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev)] p-7 animate-in fade-in-50 zoom-in-95 duration-300">
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt=""
            className="size-[52px] rounded-2xl mx-auto shadow-[var(--shadow-warm)]"
          />
          <div className="text-[21px] font-bold tracking-tight mt-3">
            X<span className="text-primary">Router</span>
          </div>
          <div className="text-[11.5px] text-text-subtle uppercase tracking-[.12em] mt-1">
            llm gateway
          </div>
        </div>

        {err && (
          <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 text-red-500 text-[13px] px-3 py-2.5 mb-4">
            {err}
          </div>
        )}

        <form onSubmit={submit}>
          <label className="flex flex-col gap-1.5 mb-4">
            <span className="text-xs font-semibold text-text-muted">Password</span>
            <input
              type="password"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full rounded-[10px] border border-border bg-bg-alt px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(229,106,74,.18)] transition-all"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !pw}
            className="w-full h-10 rounded-[10px] bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white text-sm font-semibold shadow-[var(--shadow-warm)] transition-all active:scale-[.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[17px]">
              {busy ? "progress_activity" : "login"}
            </span>
            {busy ? "Memeriksa..." : "Masuk"}
          </button>
        </form>

        <div className="text-center text-[11.5px] text-text-subtle mt-4">
          session 12 jam · pbkdf2-sha256
        </div>
      </div>
    </div>
  );
}
