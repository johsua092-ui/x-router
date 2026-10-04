// X Router — gateway core: routing model → provider → upstream, streaming SSE.
// Port 1:1 dari server.py (resolusi delimiter "provider-", tanpa strip body).

import {
  loadRegistry, listConnections, logUsage, addTokens,
} from "./db";

const UPSTREAM_TIMEOUT = 120_000;

export function registry() {
  return loadRegistry();
}

const endsWith = (s, suf) => String(s || "").toLowerCase().endsWith(String(suf).toLowerCase());

function pickUpstream(p, modelId) {
  for (const mm of p.models || []) {
    if (mm.id.toLowerCase() === modelId.toLowerCase()) return mm.upstream || mm.id;
  }
  return null;
}

export function resolveModel(model) {
  if (!model) return [null, null];
  const m = String(model).trim();
  const ml = m.toLowerCase();
  const provs = registry();

  // 1) namespace prefix: <provider>-<rest>
  const head = ml.includes("-") ? ml.split("-")[0] : ml;
  for (const p of provs) {
    const aliases = new Set([
      p.id.toLowerCase(), p.alias.toLowerCase(),
      ...(p.aliases || []).map((a) => a.toLowerCase()),
    ]);
    if (aliases.has(head) && ml.includes("-")) {
      const exact = pickUpstream(p, m);
      if (exact) return [p, exact];
      const rest = m.split("-").slice(1).join("-");
      return [p, pickUpstream(p, rest) || rest];
    }
  }

  // 2) exact id di katalog manapun
  for (const p of provs) {
    const up = pickUpstream(p, m);
    if (up) return [p, up];
  }
  return [null, null];
}

export function pickConnection(providerId) {
  const conns = listConnections(providerId, true);
  if (!conns.length) return null;
  conns.sort(
    (a, b) => (a.priority ?? 100) - (b.priority ?? 100) ||
              String(a.createdAt).localeCompare(String(b.createdAt))
  );
  return conns[0];
}

export function upstreamUrl(p, kind, clientFormat) {
  const base = String(p.baseUrl || "").replace(/\/+$/, "");
  const suffix = p.urlSuffix || "";
  const fmt = p.format || "openai";

  if (fmt === "claude") {
    if (kind === "chat") return endsWith(base, "/messages") ? base : base + "/messages";
    if (kind === "count_tokens") {
      return base.replace(/\/messages$/i, "") + "/messages/count_tokens";
    }
    if (kind === "models") return base.replace(/\/messages$/i, "") + "/models";
    return base;
  }

  let root;
  if (endsWith(base, "/chat/completions")) root = base.slice(0, -"/chat/completions".length);
  else if (endsWith(base, "/v1")) root = base;
  else root = base.includes("/v1") ? base : base + "/v1";

  if (kind === "chat") return root + "/chat/completions" + suffix;
  if (kind === "models") return root + "/models" + suffix;
  if (kind === "embeddings") return root + "/embeddings" + suffix;
  if (kind === "completions") return root + "/completions" + suffix;
  return root + "/" + kind;
}

export function buildUpstreamHeaders(p, connRow, forAnthropic) {
  const data = (connRow && connRow.data) || {};
  const key = data.apiKey || "";
  const scheme = String(p.authScheme || "bearer").toLowerCase();
  const header = p.authHeader || "Authorization";
  const hdrs = { "Content-Type": "application/json", Accept: "*/*" };
  if (key) {
    if (scheme === "raw" || scheme === "") hdrs[header] = key;
    else if (scheme === "bearer") hdrs[header] = `Bearer ${key}`;
    else hdrs[header] = `${scheme.charAt(0).toUpperCase()}${scheme.slice(1)} ${key}`;
  }
  for (const [hk, hv] of Object.entries(data.headers || {})) hdrs[hk] = hv;
  if (forAnthropic) hdrs["anthropic-version"] ||= "2023-06-01";
  return hdrs;
}

/** Parse usage dari body respons (openai / anthropic). */
export function usageFrom(data) {
  try {
    const j = JSON.parse(data);
    const u = j.usage || (j.message && j.message.usage) || {};
    return [
      u.prompt_tokens ?? u.input_tokens ?? 0,
      u.completion_tokens ?? u.output_tokens ?? 0,
    ];
  } catch {
    return [0, 0];
  }
}

export function countTokens(streamData) {
  if (!streamData) return 0;
  let total = 0;
  for (const line of String(streamData).split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      const j = JSON.parse(line.slice(5).trim());
      const u = j.usage;
      if (u) total = (u.total_tokens || 0) || total;
    } catch { /* keep */ }
  }
  return total;
}

/**
 * Forward request ke upstream.
 * - stream=true  : relai chunk-per-chunk lewat ReadableStream (SSE)
 * - stream=false : buffer penuh, kembalikan {status, body, headers}
 * Selalu catat usage + kirim token balik ke API key pemanggil.
 */
export async function forward({ payload, clientFormat, kind = "chat", model }) {
  const t0 = Date.now();
  const [p, upModel] = resolveModel(model);
  if (!p) {
    return {
      status: 404,
      json: {
        error: {
          message: `model '${model}' tidak dikenal / provider belum aktif`,
          type: "not_found",
        },
      },
    };
  }
  const conn = pickConnection(p.id);
  if (!conn) {
    return {
      status: 503,
      json: {
        error: {
          message: `provider '${p.name}' belum punya koneksi aktif`,
          type: "unavailable",
        },
      },
    };
  }

  const body = { ...payload };
  if (upModel && upModel !== model) body.model = upModel;

  let url = upstreamUrl(p, kind, clientFormat);
  const cbu = (conn.data || {}).baseUrl;
  if (cbu && kind === "chat") {
    const base = String(cbu).replace(/\/+$/, "");
    if (endsWith(base, "/messages") || endsWith(base, "/chat/completions")) url = base;
    else url = base + (p.format === "claude" ? "/messages" : "/chat/completions");
  }

  const headers = buildUpstreamHeaders(p, conn, clientFormat === "anthropic");
  const useStream = Boolean(body.stream);
  const elapsed = () => Date.now() - t0;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    logUsage({
      provider: p.id, model, endpoint: kind, status: "upstream_error",
      latencyMs: elapsed(), connectionId: conn.id,
    });
    return {
      status: 502,
      json: { error: { message: `upstream error: ${err.message}`, type: "upstream_error" } },
    };
  }

  const ctype = resp.headers.get("content-type") || "";

  // ---------- streaming SSE ----------
  if (useStream && resp.ok && ctype.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buf = "";
    let sawUsage = false;
    let clientGone = false;

    const stream = new ReadableStream({
      async start(controller2) {
        try {
          for await (const chunk of resp.body) {
            const text = decoder.decode(chunk, { stream: true });
            buf += text;
            if (buf.includes('"usage"')) sawUsage = true;
            controller2.enqueue(encoder.encode(text));
          }
        } catch {
          clientGone = true;
        } finally {
          clearTimeout(timer);
          const status = clientGone ? "client_gone" : "ok";
          logUsage({
            provider: p.id, model, endpoint: kind, status,
            latencyMs: elapsed(), completionTokens: countTokens(buf),
            connectionId: conn.id,
          });
          if (sawUsage) {
            // token dari usage akhir (jika ada) — sudah dihitung via countTokens
          }
          try { controller2.close(); } catch { /* closed */ }
        }
      },
      cancel() {
        clientGone = true;
        clearTimeout(timer);
        try { resp.body.cancel(); } catch { /* noop */ }
      },
    });

    return {
      status: 200,
      stream,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "close",
        "X-Accel-Buffering": "no",
      },
      usedStream: true,
      keyAdd: 0,
    };
  }

  // ---------- buffer biasa ----------
  clearTimeout(timer);
  let data = Buffer.alloc(0);
  try {
    data = Buffer.from(await resp.arrayBuffer());
  } catch { /* noop */ }

  const status = resp.status < 400 ? "ok" : `http_${resp.status}`;
  const [pt, ct] = usageFrom(data);
  logUsage({
    provider: p.id, model, endpoint: kind, status,
    latencyMs: elapsed(), promptTokens: pt, completionTokens: ct,
    connectionId: conn.id,
  });

  return {
    status: resp.status,
    body: data,
    headers: { "Content-Type": ctype || "application/json; charset=utf-8" },
    promptTokens: pt,
    completionTokens: ct,
  };
}
