# X Router

LLM gateway sendiri — OpenAI + Anthropic compatible, multi-provider router.
Stdlib Python, tanpa dependency.

## Jalan

```bash
python3 server.py                 # port 8080 (default)
XR_PORT=9000 XR_ADMIN_PW=xxx python3 server.py
```

Tanpa `XR_ADMIN_PW`, password admin random dicetak di console saat pertama jalan.

- Dashboard: `http://localhost:8080/` (login)
- Health: `GET /health`

## Endpoint

| Protocol | Method | Path |
|---|---|---|
| OpenAI | GET | `/v1/models` |
| OpenAI | POST | `/v1/chat/completions` (stream SSE diteruskan) |
| OpenAI | POST | `/v1/completions`, `/v1/embeddings` |
| Anthropic | GET | `/v1/models` |
| Anthropic | POST | `/v1/messages` (stream diteruskan) |
| Anthropic | POST | `/v1/messages/count_tokens` |

Auth: `Authorization: Bearer xr-...` atau `x-api-key: xr-...` (key dibuat di menu API Keys).

## Struktur

```
server.py               # HTTP server + routing + forward + halaman
db.py                   # SQLite (skema gaya 9router)
registry/providers.json # 119 provider / 777 model (diimport dari fork 9router)
tools/import-registry.mjs
static/style.css        # Void Terminal + oranye Synapse
static/motion.css       # animasi SVG
static/icons.svg        # sprite ikon (tanpa emoji)
static/logo.png         # caduceus emas
data/                   # sqlite + override registry (jangan di-commit)
```

## Skema DB (mirip 9router)

`providerConnections` (multi akun per provider, priority + isActive), `apiKeys`
(tokenLimit/usedTokens/allowedModels), `usageHistory`, `requestDetails`, `kv`,
plus `users`/`sessions` buat login dashboard. PRAGMA WAL + busy_timeout.

## Routing

- Namespace `provider-...` (alias/id) → cocok. `deepseek-v4-flash` ada di catalog → pakai persis.
- Delimiter wajib: `deepseek` mentah TIDAK di-claim, jatuh 404.
- Exact model id juga dicari di semua provider aktif.
- Koneksi upstream: ambil `providerConnections` aktif, priority terendah dulu.
- Field request ga pernah di-strip (temperature/max_tokens/dll diteruskan apa adanya).

## Import ulang registry

```bash
git clone --depth 1 https://github.com/johsua092-ui/9router /tmp/9r-ref   # read-only
node tools/import-registry.mjs /tmp/9r-ref
```
