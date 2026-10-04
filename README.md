# X Router

Satu endpoint untuk semua provider AI lo. OpenAI-compatible + Anthropic-compatible,
dashboard gaya 9router dengan identitas sendiri: **oranye `#E56A4A`**, logo caduceus,
ikon SVG + animasi, tanpa emoji.

**Live:** https://xrouter.consoleapi.qzz.io

---

## Stack

- **Next.js 14** (App Router) + React 18 + Tailwind v4
- **SQLite** lewat `node:sqlite` (WAL) — skema diadopsi dari 9router
- Login **password-only** — PBKDF2-SHA256 (200k iterasi), session cookie 12 jam
- Auth gate di `src/middleware.js` (redirect sebelum shell render) + validasi sesi
  sesungguhnya di `(dashboard)/layout.js`

## Jalanin

```bash
npm ci
npm run build
npm start                 # port 8080

# atau mode dev
npm run dev               # port 8080
```

Password admin: `synapse123`. Ganti lewat **Settings → Ganti password**
(minimal 6 karakter, sesi lama otomatis dibuang).

## Deploy ke Railway

Repo udah disiapin:

- `railway.json` — builder Nixpacks, start `npm run start:railway`,
  healthcheck `/health`, restart `ON_FAILURE`
- `scripts/start.mjs` — baca `PORT` / `HOSTNAME` dari env (Railway inject `PORT`)

Cara pakai: connect repo `johsua092-ui/x-router` di Railway, tambah **Volume**
di path `/data`, set env:

```
XR_DATA_DIR=/data
```

Tanpa volume, DB ikut container — restart = data reset (fine buat test).

### Env vars

| Var | Default | Fungsi |
|---|---|---|
| `PORT` | `8080` | port HTTP |
| `HOSTNAME` | `0.0.0.0` | bind address |
| `XR_DATA_DIR` | `./data` | lokasi `xrouter.db` + backup |
| `XR_ADMIN_PW` | random | password admin saat user pertama dibuat |

## Endpoint

Base URL: `https://xrouter.consoleapi.qzz.io`

**OpenAI-style** (auth: `Authorization: Bearer <key>`)

- `GET  /v1/models`
- `POST /v1/chat/completions` — streaming SSE + non-stream
- `POST /v1/completions`
- `POST /v1/embeddings`

**Anthropic-style** (auth: `x-api-key`, header `anthropic-version: 2023-06-01`)

- `POST /v1/messages`

**Ops**

- `GET /health`

### Contoh

```bash
curl https://xrouter.consoleapi.qzz.io/v1/chat/completions \
  -H "Authorization: Bearer xr-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"halo"}]}'
```

Streaming:

```bash
curl -N https://xrouter.consoleapi.qzz.io/v1/chat/completions \
  -H "Authorization: Bearer xr-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","stream":true,"messages":[{"role":"user","content":"halo"}]}'
```

## Routing model

1. **Namespace prefix** — `deepseek-v4-flash` → cari provider yang alias-nya
   `deepseek`, lalu sisanya jadi id model upstream
2. **Exact id** — id model ketemu langsung di katalog provider manapun
3. Body request **tidak pernah di-strip** — field apa pun diteruskan utuh
4. Model tak dikenal → `404`. Provider belum ada koneksi → `503`.
   Key salah → `401`.

## Dashboard

| Halaman | Isi |
|---|---|
| **Endpoint & Key** | base URL, API key (generate/cabut), snippet curl OpenAI & Anthropic |
| **Providers** | koneksi aktif (key di-mask), form tambah, katalog 119 provider **dengan foto logo** |
| **Models** | 777 model, digroup per provider, search (`/`), filter terhubung, klik salin id |
| **Usage** | chart token 14 hari, bar per provider, model teratas, sparkline, p50/p95 |
| **Console Log** | request terakhir, auto-refresh 3 detik, live/pause + auto-scroll |
| **Settings** | tema, ganti password, info runtime, backup DB (rotasi 10), bersih log |

Tema: gelap default + toggle terang, shortcut **G**. Data refresh tiap 15 detik.

## Struktur

```
src/
  app/
    (dashboard)/         # 6 halaman, di-gate middleware + layout
    api/                 # auth, keys, providers, stats, settings
    v1/                  # gateway routes (chat, messages, models, ...)
    login/  health/
  lib/
    db.js                # SQLite layer, skema 9router + auth
    gateway.js           # resolusi model, routing, SSE relay
    api.js               # helper auth + credit token
  shared/components/     # Sidebar, Header, ui, Toast, Theme, ProviderIcon
middleware.js            # auth gate (redirect sebelum shell)
scripts/start.mjs        # start lintas-platform (Railway/VPS)
registry/providers.json  # 119 provider / 777 model (tools/import-registry.mjs)
railway.json
```

## Registry

Regenerasi katalog dari fork 9router (read-only, nol sentuh repo 9r):

```bash
node tools/import-registry.mjs
```

## Isolasi dari 9router

- DB sendiri: `data/xrouter.db`, bisa dipindah lewat `XR_DATA_DIR`
- systemd sandbox: `ProtectSystem=strict` + `ReadWritePaths=/root/x-router`
  — cuma boleh nulis di dir sendiri
- HOME service diarahkan ke `sandbox-home` biar nggak pernah nyasar ke `~/.9router`
- nginx server block terpisah, `nginx -t` lolos sebelum reload
