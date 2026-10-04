# X Router

LLM gateway OpenAI-compatible — multi-provider router, versi sendiri.

## Jalankan

```bash
python3 server.py            # :20130
XR_PORT=20140 python3 server.py
XR_ADMIN_PW=rahasia python3 server.py   # set password admin awal
```

Tanpa `XR_ADMIN_PW`, password admin random dicetak di console saat pertama jalan.

- Dashboard: `http://localhost:20130/` (login dulu)
- Health: `GET /health`
- API: `GET /v1/models`, `POST /v1/chat/completions` (Bearer API key dari menu API Keys)

## Struktur

```
server.py        # stdlib, no deps — auth + session + halaman + stub routing
static/style.css # tema Void Terminal (oranye Synapse)
static/logo.png  # caduceus emas
data/            # sqlite + config.json (auto-dibuat, jangan di-commit)
```

## Catatan teknis (dari skill)

- Routing pakai delimiter `provider-`, bukan prefix longgar — model tak dikenal jatuh ke default.
- Dispatch provider **sebelum** resource acquisition (browser/session/key lock).
- Validasi request body jangan strict-schema — field yang ga dikenal diteruskan, jangan di-strip.
- `/v1/models` hanya advertise provider yang key-nya keisi.
