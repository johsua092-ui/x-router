"use client";

import { useState, useEffect, useRef } from "react";

export default function ClaimPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState("");
  const [activeSnippetTab, setActiveSnippetTab] = useState("curl"); // "curl" | "python" | "cursor" | "cline"

  // Bansos pool info
  const [bansosInfo, setBansosInfo] = useState(null);
  const [loadingBansos, setLoadingBansos] = useState(true);

  // Anti-Bot: Page load timestamp & Honeypot field
  const pageLoadTime = useRef(Date.now());
  const [honeypot, setHoneypot] = useState("");

  // Check active Bansos & URL params
  useEffect(() => {
    pageLoadTime.current = Date.now();
    const fetchBansos = async () => {
      try {
        const res = await fetch("/api/vouchers/claim");
        if (res.ok) {
          const data = await res.json();
          if (data.hasActiveBansos && data.bansos) {
            setBansosInfo(data.bansos);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBansos(false);
      }
    };
    fetchBansos();

    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const c = p.get("code");
      if (c) setCode(c.toUpperCase());
    }
  }, []);

  // 1-Click Bansos Claim (NO PASSWORD / NO KEY NEEDED!)
  const handleClaimBansos = async () => {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await fetch("/api/vouchers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBansos: true,
          website: honeypot,
          _t: pageLoadTime.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal klaim bansos token");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message || "Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Specific Voucher Code Claim
  const handleClaimCustom = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await fetch("/api/vouchers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          website: honeypot,
          _t: pageLoadTime.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to redeem voucher code");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message || "Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSnippet(type);
      setTimeout(() => setCopiedSnippet(""), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-between selection:bg-brand-500/30 selection:text-brand-400">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(229,106,74,0.09),transparent_60%)]" />

      {/* Top Header */}
      <header className="relative z-10 flex h-14 w-full items-center justify-between border-b border-[#222] bg-[#0c0c0e]/80 px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-[4px] bg-[#E56A4A]/10 text-[#E56A4A] border border-[#E56A4A]/30">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
            </svg>
          </span>
          <span className="font-mono text-sm font-bold tracking-wider text-white">
            X ROUTER <span className="text-[11px] text-[#888] font-normal">· BANSOS & TOKEN MARKET</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#888]">
          <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>PORTAL ACTIVE</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          {!result ? (
            /* Main Claim Container */
            <div className="rounded-[10px] border border-[#262626] bg-[#101012] p-6 sm:p-8 shadow-2xl space-y-6">
              
              {/* Header Title */}
              <div className="text-center space-y-2">
                <div className="inline-flex size-12 items-center justify-center rounded-[8px] bg-[#E56A4A]/10 text-[#E56A4A] border border-[#E56A4A]/25 mb-1 shadow-[0_0_15px_rgba(229,106,74,0.15)]">
                  <span className="material-symbols-outlined text-2xl">volunteer_activism</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Klaim Bansos AI X Router
                </h2>
                <p className="text-xs sm:text-sm text-[#888] max-w-md mx-auto">
                  Dapatkan API Key siap pakai langsung dalam 1 klik tanpa ribet masukin password atau kunci.
                </p>
              </div>

              {/* SECTION 1: 1-CLICK INSTANT BANSOS CLAIM */}
              {bansosInfo ? (
                <div className="rounded-[8px] border border-emerald-500/40 bg-emerald-500/5 p-4 sm:p-5 space-y-3 relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 size-24 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
                  
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                        ⚡ POOL BANSOS AKTIF
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1.5">{bansosInfo.name}</h3>
                      <p className="text-xs text-[#aaa] mt-0.5">{bansosInfo.description || "Token gratis siap pakai untuk kebutuhan coding dan chat."}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono py-1">
                    <div className="bg-[#121814] p-2 rounded border border-emerald-500/20 text-center">
                      <span className="text-[#777] block text-[9px]">KUOTA</span>
                      <span className="text-white font-bold">{bansosInfo.tokenLimit === 0 ? "Unlimited" : `${(bansosInfo.tokenLimit / 1000).toLocaleString()}K`}</span>
                    </div>
                    <div className="bg-[#121814] p-2 rounded border border-emerald-500/20 text-center">
                      <span className="text-[#777] block text-[9px]">SISA KUOTA</span>
                      <span className="text-emerald-400 font-bold">{bansosInfo.remainingClaims}</span>
                    </div>
                    <div className="bg-[#121814] p-2 rounded border border-emerald-500/20 text-center">
                      <span className="text-[#777] block text-[9px]">MASA AKTIF</span>
                      <span className="text-white font-bold">{bansosInfo.expiresInDays} Hari</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClaimBansos}
                    disabled={loading}
                    className="w-full rounded-[6px] bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <span className="inline-block size-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Menerbitkan API Key Bansos...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">bolt</span>
                        <span>⚡ Klaim Bansos 1-Klik (Langsung Dapat Key)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : !loadingBansos && (
                <div className="rounded-[8px] border border-[#2a2a2a] bg-[#141417] p-4 text-center space-y-1">
                  <span className="text-xs text-[#888]">Saat ini belum ada bansos publik yang dibuka oleh Admin.</span>
                </div>
              )}

              {/* DIVIDER */}
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-[#262626]" />
                <span className="text-[11px] font-mono text-[#666] uppercase">Atau Redeem Kode Khusus</span>
                <div className="flex-1 h-px bg-[#262626]" />
              </div>

              {/* SECTION 2: CUSTOM VOUCHER CODE CLAIM */}
              <form onSubmit={handleClaimCustom} className="space-y-3.5">
                {/* Honeypot field for bot traps */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  style={{ display: "none" }}
                  aria-hidden="true"
                />

                <div>
                  <label className="block text-[11px] font-mono text-[#aaa] uppercase tracking-wider mb-1.5">
                    Punya Voucher / VIP Pass Code?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. VIP-PRO-100K"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="flex-1 rounded-[6px] border border-[#333] bg-[#16161a] px-3.5 py-2 font-mono text-sm tracking-wider text-white uppercase placeholder:text-[#555] focus:border-[#E56A4A] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loading || !code.trim()}
                      className="rounded-[6px] bg-[#E56A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d0593b] disabled:opacity-50 transition-colors shrink-0"
                    >
                      Redeem
                    </button>
                  </div>
                </div>
              </form>

              {error && (
                <div className="rounded-[6px] border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2 border-t border-[#222] text-center text-xs text-[#666]">
                Dilindungi 10-Lapis Anti-Abuse Shield · 1 Klaim per IP/Hari · Bot Protected
              </div>
            </div>
          ) : (
            /* Claim Success & Quickstart Exporter */
            <div className="rounded-[10px] border border-[#262626] bg-[#101012] p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Success Badge */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 mb-1">
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  API Key Berhasil Diterbitkan!
                </h2>
                <p className="text-xs text-[#888]">
                  Simpan API Key di bawah sekarang. Kunci langsung aktif dan siap dipasang ke tool coding lo.
                </p>
              </div>

              {/* API Key Plate */}
              <div className="rounded-[8px] border border-[#E56A4A]/40 bg-[#16161a] p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#aaa]">
                  <span>YOUR X ROUTER API KEY</span>
                  <span className="text-emerald-400 font-bold">● ACTIVE & READY</span>
                </div>

                <div className="flex items-center gap-2 rounded-[6px] border border-[#333] bg-[#0c0c0e] p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={result.apiKey}
                    className="flex-1 bg-transparent font-mono text-sm text-white select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.apiKey, "key")}
                    className="inline-flex items-center gap-1 rounded-[4px] bg-[#E56A4A] px-3 py-1 text-xs font-semibold text-white hover:bg-[#d0593b] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedKey ? "check" : "content_copy"}
                    </span>
                    <span>{copiedKey ? "Copied!" : "Copy"}</span>
                  </button>
                </div>

                {/* Quota Chips */}
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono pt-1 text-center">
                  <div className="rounded-[4px] bg-[#202026] p-2">
                    <span className="text-[#777] block text-[10px]">KUOTA TOKEN</span>
                    <span className="font-semibold text-white">
                      {result.tokenLimit === 0 ? "Unlimited" : `${(result.tokenLimit / 1000).toLocaleString()}K`}
                    </span>
                  </div>
                  <div className="rounded-[4px] bg-[#202026] p-2">
                    <span className="text-[#777] block text-[10px]">MODEL ACCESS</span>
                    <span className="font-semibold text-white truncate block" title={result.allowedModels}>
                      {result.allowedModels === "*" ? "Semua (*)" : result.allowedModels}
                    </span>
                  </div>
                  <div className="rounded-[4px] bg-[#202026] p-2">
                    <span className="text-[#777] block text-[10px]">MASA AKTIF</span>
                    <span className="font-semibold text-white">
                      {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : "Selamanya"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Endpoint URL Field */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-[#aaa]">BASE URL (OPENAI COMPATIBLE)</label>
                <div className="flex items-center gap-2 rounded-[6px] border border-[#2a2a2a] bg-[#16161a] p-2 text-xs font-mono">
                  <span className="flex-1 text-[#ccc] truncate">{result.baseUrl}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.baseUrl, "baseUrl")}
                    className="text-[#888] hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copiedSnippet === "baseUrl" ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
              </div>

              {/* One-Click Presets & Quickstarts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-[#222] pb-2 font-mono">
                  <span className="text-[#aaa] font-bold">CLIENT QUICKSTART</span>
                  <div className="flex items-center gap-1">
                    {["curl", "python", "cursor", "cline"].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveSnippetTab(tab)}
                        className={`px-2 py-0.5 rounded-[4px] uppercase text-[10px] transition-colors ${
                          activeSnippetTab === tab
                            ? "bg-[#E56A4A] text-white font-bold"
                            : "text-[#777] hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {activeSnippetTab === "curl" && (
                  <div className="relative rounded-[6px] border border-[#262626] bg-[#0c0c0e] p-3 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.configs.curl, "curl")}
                      className="absolute right-2 top-2 rounded-[4px] bg-[#1c1c20] px-2 py-1 text-[10px] text-[#aaa] hover:text-white"
                    >
                      {copiedSnippet === "curl" ? "Copied!" : "Copy"}
                    </button>
                    <pre className="overflow-x-auto text-[#ccc] pr-12">{result.configs.curl}</pre>
                  </div>
                )}

                {activeSnippetTab === "python" && (
                  <div className="relative rounded-[6px] border border-[#262626] bg-[#0c0c0e] p-3 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.configs.python, "python")}
                      className="absolute right-2 top-2 rounded-[4px] bg-[#1c1c20] px-2 py-1 text-[10px] text-[#aaa] hover:text-white"
                    >
                      {copiedSnippet === "python" ? "Copied!" : "Copy"}
                    </button>
                    <pre className="overflow-x-auto text-[#ccc] pr-12">{result.configs.python}</pre>
                  </div>
                )}

                {activeSnippetTab === "cursor" && (
                  <div className="rounded-[6px] border border-[#262626] bg-[#0c0c0e] p-3 space-y-2 text-xs">
                    <p className="text-[#aaa] text-[11px]">
                      Buka <strong>Cursor Settings → Models → OpenAI API Key</strong>:
                    </p>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between bg-[#16161a] p-2 rounded">
                        <span className="text-[#888]">Base URL:</span>
                        <span className="text-white select-all">{result.baseUrl}</span>
                      </div>
                      <div className="flex justify-between bg-[#16161a] p-2 rounded">
                        <span className="text-[#888]">API Key:</span>
                        <span className="text-white select-all">{result.apiKey}</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeSnippetTab === "cline" && (
                  <div className="rounded-[6px] border border-[#262626] bg-[#0c0c0e] p-3 space-y-2 text-xs">
                    <p className="text-[#aaa] text-[11px]">
                      Di <strong>Cline / Roo Code Settings</strong>, pilih <code>OpenAI-Compatible</code>:
                    </p>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between bg-[#16161a] p-2 rounded">
                        <span className="text-[#888]">Base URL:</span>
                        <span className="text-white select-all">{result.baseUrl}</span>
                      </div>
                      <div className="flex justify-between bg-[#16161a] p-2 rounded">
                        <span className="text-[#888]">API Key:</span>
                        <span className="text-white select-all">{result.apiKey}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setCode("");
                  }}
                  className="text-xs font-mono text-[#888] hover:text-white underline underline-offset-4"
                >
                  Klaim lagi atau redeem kode lain
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#222] bg-[#0c0c0e]/80 py-3 px-4 text-center text-xs text-[#666] font-mono">
        © 2026 X Router · Autonomous AI Gateway & Routing Infrastructure
      </footer>
    </div>
  );
}
