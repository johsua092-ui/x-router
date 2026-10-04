# X Router

> Gateway LLM OpenAI + Anthropic-compatible. Satu endpoint untuk semua provider lo.
> Di-remake dari [9router](https://github.com/serenhope/9router) (MIT) — UI, nama, logo, dan password diganti.

**Repo:** https://github.com/johsua092-ui/x-router

## Yang beda dari 9router

- **Nama & identitas** — X Router, logo caduceus, brand oranye `#E56A4A`
- **Password default** — `synapse123` (bukan `seren123`); teks hint password dihapus dari halaman login
- **Update diarahin ke repo ini** — cek versi, changelog, link GitHub, dan skill links semua nunjuk `johsua092-ui/x-router` (branch `main`), bukan repo upstream
- **UI di-polish** — welcome modal baru (aurora glow + CTA masuk dashboard), title login gradient, glow pojok global, focus ring seragam oranye, toast animasi
- **Data terisolasi** — `DATA_DIR=/root/xrouter-remake/data`, jadi nggak pernah nabrak `~/.9router` milik instalasi 9router asli

## Jalanin

```bash
npm install
npm run build
DATA_DIR=./data INITIAL_PASSWORD=synapse123 node custom-server.js --port 8080
```

Buka `http://127.0.0.1:8080/login` → password `synapse123`.

### Systemd (cara deploy di VPS ini)

```ini
[Service]
WorkingDirectory=/root/xrouter-remake
Environment=DATA_DIR=/root/xrouter-remake/data
Environment=INITIAL_PASSWORD=synapse123
ExecStart=/usr/local/bin/node custom-server.js --port 8080
```

Jangan pernah pakai `DATA_DIR` yang sama dengan instalasi 9router (default `~/.9router`) — dua app boleh jalan bareng asal datanya terpisah.

## Endpoint

| Endpoint | Protocol |
|---|---|
| `POST /v1/chat/completions` | OpenAI (+ streaming SSE) |
| `POST /v1/messages` | Anthropic |
| `GET  /v1/models` | daftar model |
| `GET  /api/health` | health check |

Base URL publik: `https://xrouter.consoleapi.qzz.io/v1`

Auth: `Authorization: Bearer sk-...` (API key dibuat dari dashboard → Endpoint & Key).

## Dashboard

`https://xrouter.consoleapi.qzz.io` — password-only login.

- **Endpoint & Key** — base URL, snippet cURL/Python, kelola API key
- **Providers** — koneksi upstream + logo provider (159 PNG)
- **Combo & Vision Adapter**, **Usage**, **Quota Tracker**, **Token Saver**, **CLI Tools**
- **Console Log** — log realtime
- **X Router Settings** — password, backup, pricing

## Stack

Next.js 14 · React 18 · node:sqlite (driver `better-sqlite3` 12 untuk Node 26) · Tailwind — tanpa emoji di UI (ikon Material Symbols), logo PNG caduceus.

## Lisensi

MIT — berbasis 9router (serenhope/decolua). Terima kasih upstream-nya.
