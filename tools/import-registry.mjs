#!/usr/bin/env node
// Regenerate registry/providers.json dari fork 9router (johsua092-ui/9router).
// Pakai:  node tools/import-registry.mjs /path/ke/9router
// Read-only — repo 9router TIDAK disentuh.
import fs from "node:fs";
import path from "node:path";

const repo = process.argv[2];
if (!repo) {
  console.error("usage: node tools/import-registry.mjs /path/to/9router-clone");
  process.exit(1);
}

const regPath = path.join(repo, "open-sse", "providers", "registry", "index.js");
const { default: REG } = await import(new URL("file://" + regPath));

const out = REG.map((e) => ({
  id: e.id,
  alias: e.alias || e.id,
  aliases: e.aliases || [],
  category: e.category,
  name: (e.display && e.display.name) || e.id,
  color: (e.display && e.display.color) || null,
  baseUrl: (e.transport && e.transport.baseUrl) || null,
  format: (e.transport && e.transport.format) || "openai",
  urlSuffix: (e.transport && e.transport.urlSuffix) || "",
  authHeader: (e.transport && e.transport.auth && e.transport.auth.header) || "Authorization",
  authScheme: (e.transport && e.transport.auth && e.transport.auth.scheme) || "bearer",
  passthrough: !!(e.transport && e.transport.passthroughModels),
  noAuth: !!e.noAuth,
  hasOAuth: !!e.oauth,
  models: (e.models || []).map((m) =>
    typeof m === "string"
      ? { id: m }
      : { id: m.id, name: m.name || m.id, upstream: m.upstreamModelId || null }
  ),
}));

const dest = new URL("../registry/providers.json", import.meta.url);
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`providers: ${out.length}, models: ${out.reduce((a, p) => a + p.models.length, 0)}`);
console.log(`-> ${path.resolve(dest.pathname)}`);
