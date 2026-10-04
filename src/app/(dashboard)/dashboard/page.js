"use client";

import { useEffect, useState } from "react";
import { Card, Button, Pill, Field } from "@/shared/components/ui";
import { useToast } from "@/shared/components/Toast";

const BASE = typeof window !== "undefined" ? window.location.origin : "";

function Copyable({ value, label, className = "" }) {
  const { toast } = useToast();
  const [hit, setHit] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        toast("success", "Tersalin", `${label} disalin ke clipboard`);
        setHit(true);
        setTimeout(() => setHit(false), 1400);
      }}
      className={`flex items-center gap-2 w-full justify-between rounded-[9px] border border-border bg-bg-alt px-3 py-2 font-mono text-xs hover:border-primary/40 transition-all min-w-0 ${className}`}
    >
      <span className="truncate text-text-main">{value}</span>
      <span
        className={`material-symbols-outlined text-[16px] shrink-0 ${
          hit ? "text-green-500" : "text-text-muted"
        }`}
      >
        {hit ? "check" : "content_copy"}
      </span>
    </button>
  );
}

export default function EndpointPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState(null);
  const [tab, setTab] = useState("openai");
  const [newName, setNewName] = useState("");
  const [showModal, setShowModal] = useState(false);

  async function load() {
    const r = await fetch("/api/keys");
    if (r.ok) setKeys((await r.json()).keys);
  }
  useEffect(() => { load(); }, []);

  async function createKey() {
    const r = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName || "default" }),
    });
    const d = await r.json();
    if (r.ok) {
      toast("success", "Key dibuat", d.key);
      setNewName("");
      setShowModal(false);
      load();
    } else toast("error", "Gagal", d.error);
  }

  async function revokeKey(k) {
    if (!confirm(`Cabut key ${k.slice(0, 14)}... ? Key tidak bisa dipakai lagi.`)) return;
    const r = await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: k }),
    });
    if (r.ok) {
      toast("success", "Key dicabut");
      load();
    } else toast("error", "Gagal mencabut key");
  }

  const mainKey = keys?.find((k) => k.isActive)?.key || "(generate key dulu)";
  const curlOpenAI = `curl ${BASE}/v1/chat/completions \\
  -H "Authorization: Bearer ${mainKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"halo"}]}'`;
  const curlClaude = `curl ${BASE}/v1/messages \\
  -H "x-api-key: ${mainKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-sonnet-4-5","max_tokens":128,"messages":[{"role":"user","content":"halo"}]}'`;
  const curlNow = tab === "openai" ? curlOpenAI : curlClaude;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Base URL + key */}
        <Card title="Base URL" sub="endpoint gateway ini" icon="link">
          <div className="flex flex-col gap-2.5">
            <Copyable value={BASE} label="Base URL" />
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-muted">
                OpenAI <b className="text-brand-300 font-mono">/v1</b>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-muted">
                Anthropic <b className="text-brand-300 font-mono">/v1/messages</b>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text-muted">
                <span className="material-symbols-outlined text-[14px] text-primary">shield</span>
                Bearer + x-api-key
              </span>
            </div>
          </div>

          <div className="h-px bg-border-subtle my-4" />

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center size-[34px] rounded-[10px] bg-primary/10 border border-primary/20 text-primary">
                <span className="material-symbols-outlined text-[19px]">key</span>
              </span>
              <div>
                <div className="text-sm font-semibold">API Key</div>
                <div className="text-xs text-text-muted">klik untuk salin</div>
              </div>
            </div>
            <Button variant="primary" size="sm" icon="add" onClick={() => setShowModal(true)}>
              Generate
            </Button>
          </div>
          <Copyable value={mainKey} label="API key" />
        </Card>

        {/* Quick start */}
        <Card
          title="Quick start"
          sub="siap tempel ke terminal"
          icon="code"
          action={
            <div className="flex rounded-lg border border-border bg-bg-alt p-1">
              {["openai", "anthropic"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    tab === t
                      ? "bg-surface text-text-main shadow-sm"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  {t === "openai" ? "OpenAI" : "Anthropic"}
                </button>
              ))}
            </div>
          }
        >
          <pre className="rounded-[10px] border border-border-subtle bg-bg-alt p-4 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap break-all text-text-main">
            {curlNow}
          </pre>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              icon="content_copy"
              onClick={() => {
                navigator.clipboard?.writeText(curlNow);
                toast("success", "Tersalin", "Snippet disalin");
              }}
            >
              Salin snippet
            </Button>
            <Button size="sm" variant="ghost" icon="deployed_code" href="/models">
              Lihat model
            </Button>
          </div>
        </Card>
      </div>

      {/* daftar key */}
      <Card
        title="API Keys"
        sub={keys ? `${keys.length} key terdaftar` : "memuat..."}
        icon="vpn_key"
        action={
          <Button variant="primary" size="sm" icon="add" onClick={() => setShowModal(true)}>
            Key baru
          </Button>
        }
      >
        {!keys ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-11 rounded-lg bg-surface-2 animate-pulse" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-10 text-center">
            <span className="material-symbols-outlined text-[42px] text-text-subtle opacity-50">
              key
            </span>
            <div className="font-semibold">Belum ada API key</div>
            <div className="text-xs text-text-muted max-w-[340px]">
              Generate key pertama untuk mulai pakai endpoint /v1.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-subtle">
                  <th className="pb-2.5 px-3 font-semibold">Nama</th>
                  <th className="pb-2.5 px-3 font-semibold">Key</th>
                  <th className="pb-2.5 px-3 font-semibold">Tokens</th>
                  <th className="pb-2.5 px-3 font-semibold">Terakhir</th>
                  <th className="pb-2.5 px-3 font-semibold">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr
                    key={k.key}
                    className="border-t border-border-subtle hover:bg-surface-2/50 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-medium">{k.name || "default"}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(k.key);
                          toast("success", "Tersalin", "API key disalin");
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-alt px-2.5 py-1.5 font-mono text-xs hover:border-primary/40 transition-all"
                      >
                        {k.key.slice(0, 12)}...{k.key.slice(-4)}
                        <span className="material-symbols-outlined text-[14px] text-text-muted">
                          content_copy
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {(k.usedTokens || 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-text-muted">{k.lastUsedAt || "never"}</td>
                    <td className="px-3 py-2.5">
                      {k.isActive ? <Pill tone="on">aktif</Pill> : <Pill tone="off">dicabut</Pill>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {k.isActive && (
                        <Button size="sm" variant="ghost" icon="block" onClick={() => revokeKey(k.key)}>
                          Cabut
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* modal key baru */}
      {showModal && (
        <div
          className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[3px] flex items-center justify-center p-5 animate-in fade-in duration-200"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev)] animate-in zoom-in-95 fade-in-50 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border-subtle">
              <span className="material-symbols-outlined text-primary">add_key</span>
              <div className="font-semibold text-sm">API key baru</div>
            </div>
            <div className="p-5">
              <Field label="Nama key" hint="Buat label pemakaian, mis. 'production'">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createKey()}
                  placeholder="default"
                  className="w-full rounded-[10px] border border-border bg-bg-alt px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition-all"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border-subtle">
              <Button onClick={() => setShowModal(false)}>Batal</Button>
              <Button variant="primary" icon="check" onClick={createKey}>
                Buat key
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
