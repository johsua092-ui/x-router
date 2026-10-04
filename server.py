#!/usr/bin/env python3
"""
X Router — OpenAI + Anthropic compatible gateway, stdlib only.

Port default 8080.  Jalankan:  python3 server.py   (atau XR_PORT=xxxx)

Endpoint:
  GET  /health
  GET  /v1/models                      (OpenAI; auth Bearer)
  POST /v1/chat/completions            (OpenAI; stream diteruskan)
  POST /v1/completions                 (OpenAI)
  POST /v1/embeddings                  (OpenAI)
  GET  /v1/models                      (Anthropic; auth x-api-key)
  POST /v1/messages                    (Anthropic; stream diteruskan)
  POST /v1/messages/count_tokens
  Dashboard: /login /logout / /providers /keys /logs
"""

import json
import os
import socket
import ssl
import threading
import time
from http import cookies as http_cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

PORT = int(os.environ.get("XR_PORT", "8080"))
HOST = os.environ.get("XR_HOST", "0.0.0.0")
UPSTREAM_TIMEOUT = 120

MIME = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".json": "application/json; charset=utf-8",
}

# cache registry
_registry = None
_reg_lock = threading.Lock()


def registry():
    global _registry
    with _reg_lock:
        if _registry is None:
            _registry = db.load_registry()
        return _registry


def invalidate_registry():
    global _registry
    with _reg_lock:
        _registry = None


# ---------------------------------------------------------------- routing

def resolve_model(model: str):
    """model id -> (provider_dict, upstream_model_id).

    Aturan:
      1. "alias-modelid"  -> prefix sebelum '-' pertama cocok dgn alias provider
      2. id persis ada di model list provider -> pakai itu
      3. prefix longgar TIDAK dipakai (wajib delimiter), sesuai skill
    """
    if not model:
        return None, None
    m = model.strip()
    ml = m.lower()
    provs = registry()

    # 1) namespace prefix: <provider>-<rest>
    head = ml.split("-", 1)[0] if "-" in ml else ml
    for p in provs:
        aliases = {p["id"].lower(), p["alias"].lower(), *[a.lower() for a in p.get("aliases") or []]}
        if head in aliases and "-" in ml:
            # utamakan id persis ("deepseek-v4-flash" ada di catalog)
            exact = _pick_upstream(p, m)
            if exact:
                return p, exact
            rest = m.split("-", 1)[1]
            up = _pick_upstream(p, rest) or rest
            return p, up

    # 2) exact model id di catalog manapun
    for p in provs:
        up = _pick_upstream(p, m)
        if up:
            return p, up

    return None, None


def _pick_upstream(p, model_id):
    for mm in p.get("models") or []:
        if mm["id"].lower() == model_id.lower():
            return mm.get("upstream") or mm["id"]
    return None


def pick_connection(provider_id: str):
    conns = db.list_connections(provider_id, active_only=True)
    if conns:
        conns.sort(key=lambda c: (c.get("priority") or 100, c.get("createdAt") or ""))
        return conns[0]
    return None


def upstream_url(p, kind, client_format):
    """kind: 'chat' | 'models' | 'count_tokens' | 'embeddings' | 'completions'"""
    base = (p.get("baseUrl") or "").rstrip("/")
    suffix = p.get("urlSuffix") or ""
    fmt = p.get("format") or "openai"
    if fmt == "claude":
        if kind == "chat":
            return base + ("/messages" if not _endswith(base, "/messages") else "")
        if kind == "count_tokens":
            return base.replace("/messages", "") + "/messages/count_tokens"
        if kind == "models":
            return base.replace("/messages", "") + "/models"
        return base
    # openai family
    if _endswith(base, "/chat/completions"):
        root = base[: -len("/chat/completions")]
    elif _endswith(base, "/v1"):
        root = base
    else:
        root = base + "/v1" if "/v1" not in base else base
    if kind == "chat":
        return root + "/chat/completions" + suffix
    if kind == "models":
        return root + "/models" + suffix
    if kind == "embeddings":
        return root + "/embeddings" + suffix
    if kind == "completions":
        return root + "/completions" + suffix
    return root + "/" + kind


def _endswith(s, suf):
    return s.lower().endswith(suf.lower())


def build_upstream_headers(p, conn_row, for_anthropic):
    data = (conn_row or {}).get("data") or {}
    key = data.get("apiKey") or os.environ.get(data.get("keyEnv") or "", "")
    scheme = (p.get("authScheme") or "bearer").lower()
    header = p.get("authHeader") or "Authorization"
    hdrs = {"Content-Type": "application/json", "Accept": "*/*"}
    if key:
        if scheme in ("raw", ""):
            hdrs[header] = key
        else:
            hdrs[header] = f"{scheme.capitalize()} {key}" if scheme != "bearer" else f"Bearer {key}"
    # custom headers dari connection (mis. anthropic version)
    for hk, hv in (data.get("headers") or {}).items():
        hdrs[hk] = hv
    if for_anthropic:
        hdrs.setdefault("anthropic-version", "2023-06-01")
    return hdrs


def http_exchange(method, url, headers, body: bytes, client_sock_send):
    """Forward + streaming. client_sock_send(bytes) buat relay SSE."""
    import urllib.request

    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, data=body if method == "POST" else None,
                                 headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT, context=ctx)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)
    except Exception as e:
        return 502, json.dumps({"error": {"message": f"upstream error: {e}",
                                           "type": "upstream_error"}}).encode(), {}

    ctype = resp.headers.get("Content-Type", "")
    is_stream = "text/event-stream" in ctype
    if not is_stream:
        data = resp.read()
        resp.close()
        return 200, data, dict(resp.headers)

    # stream: relay chunk-by-chunk
    try:
        while True:
            chunk = resp.read(4096)
            if not chunk:
                break
            client_sock_send(chunk)
        resp.close()
    except Exception:
        pass
    return 200, None, dict(resp.headers)


# ---------------------------------------------------------------- pages

def ic(name, cls="ic"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="/static/icons.svg#i-{name}"></use></svg>'


def layout(title, body, active, user):
    nav = [
        ("dashboard", "Dashboard", "grid"),
        ("providers", "Providers", "plug"),
        ("keys", "API Keys", "key"),
        ("logs", "Logs", "logs"),
    ]
    items = "".join(
        f'<a class="nav-item {"active" if k == active else ""}" href="/{k}">'
        f'{ic(i)}<span>{label}</span></a>'
        for k, label, i in nav
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · X Router</title>
<link rel="stylesheet" href="/static/style.css">
<link rel="stylesheet" href="/static/motion.css">
<link rel="icon" href="/static/logo.png" type="image/png">
</head>
<body>
<div class="shell">
  <aside class="sidebar">
    <div class="brand">
      <img src="/static/logo.png" alt="">
      <div class="name">X<b>Router</b></div>
    </div>
    <div class="nav-label">Menu</div>
    {items}
    <div class="foot">
      <a class="nav-item" href="/logout">{ic("logout")}<span>Logout · {user}</span></a>
    </div>
  </aside>
  <main class="main">{body}</main>
</div>
</body>
</html>"""


def login_page(msg=""):
    alert = f'<div class="alert err">{msg}</div>' if msg else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Login · X Router</title>
<link rel="stylesheet" href="/static/style.css">
<link rel="stylesheet" href="/static/motion.css">
<link rel="icon" href="/static/logo.png" type="image/png">
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <img src="/static/logo.png" alt="">
      <div class="name">X<b>Router</b></div>
      <div class="tag">llm gateway</div>
    </div>
    {alert}
    <form method="post" action="/login">
      <div class="field"><label>Password</label>
        <input type="password" name="password" autocomplete="current-password" autofocus></div>
      <button class="btn primary" style="width:100%;justify-content:center" type="submit">Sign in</button>
    </form>
    <div class="hint">session 12 jam · pbkdf2-sha256</div>
  </div>
</div>
</body>
</html>"""


def page_dashboard(user):
    s = db.stats()
    provs = registry()
    with_conn = s["connections"]
    recent = s["recent"]
    if recent:
        rows = "".join(
            f'<tr><td class="lead">{r["model"] or "-"}</td><td>{r["provider"] or "-"}</td>'
            f'<td>{r["endpoint"] or "-"}</td>'
            f'<td><span class="pill {"on" if r["status"] == "ok" else "off"}">{r["status"]}</span></td>'
            f'<td>{r["latencyMs"]} ms</td><td>{r["timestamp"][11:19]}</td></tr>'
            for r in recent
        )
    else:
        rows = ('<tr><td colspan="6"><div class="empty">'
                f'{ic("empty", "ic empty-ic")}<div>Belum ada request masuk.</div>'
                "</div></td></tr>")
    body = f"""
<div class="topbar">
  <h1>Dashboard <span>//</span></h1>
  <div class="sub">x-router v0.1 · port {PORT}</div>
</div>
<div class="stats">
  <div class="stat"><div class="k">Providers</div><div class="v hot">{len(provs)}</div><div class="m">di catalog</div></div>
  <div class="stat"><div class="k">Koneksi</div><div class="v ok">{with_conn}</div><div class="m">aktif</div></div>
  <div class="stat"><div class="k">Requests</div><div class="v">{s["requests"]}</div><div class="m">{s['ok']} sukses</div></div>
  <div class="stat"><div class="k">Tokens</div><div class="v">{s["tokens"]:,}</div><div class="m">total</div></div>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Recent requests</span>
    <a class="btn ghost" href="/logs">Semua</a></div>
  <table>
    <thead><tr><th>Model</th><th>Provider</th><th>Endpoint</th><th>Status</th><th>Latency</th><th>Jam</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Endpoint</span></div>
  <div class="panel-b"><div class="log"><span class="t">openai     </span> POST /v1/chat/completions  GET /v1/models
<span class="t">anthropic  </span> POST /v1/messages          GET /v1/models
<span class="t">auth       </span> Bearer xr-...  |  x-api-key: xr-...</div></div>
</div>"""
    return layout("Dashboard", body, "dashboard", user)


def page_providers(user):
    provs = registry()
    conns = db.list_connections(active_only=False)
    by_provider = {}
    for c in conns:
        by_provider.setdefault(c["provider"], []).append(c)

    enabled = {p["id"]: p for p in provs if p["id"] in by_provider}
    # daftar semua provider di catalog, yang punya koneksi ditandai
    active_rows = "".join(
        f'<tr><td class="lead">{p["name"]}</td><td>{p["baseUrl"] or "-"}</td>'
        f'<td>{len(p["models"])}</td>'
        f'<td><span class="pill on">aktif</span></td></tr>'
        for p in provs if p["id"] in by_provider
    )
    if not active_rows:
        active_rows = ('<tr><td colspan="4"><div class="empty">'
                       f'{ic("empty", "ic empty-ic")}<div>Belum ada koneksi provider aktif.</div>'
                       "</div></td></tr>")

    # catalog buat dipilih
    opts = "".join(
        f'<option value="{p["id"]}">{p["name"]} ({len(p["models"])} model)</option>'
        for p in provs if p["category"] in ("apikey", "freeTier") and not p["noAuth"]
    )
    body = f"""
<div class="topbar">
  <h1>Providers <span>//</span></h1>
  <div class="sub">{len(provs)} di catalog · {sum(len(p['models']) for p in provs)} model</div>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Aktif</span></div>
  <table>
    <thead><tr><th>Provider</th><th>Base URL</th><th>Models</th><th>Status</th></tr></thead>
    <tbody>{active_rows}</tbody>
  </table>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Tambah koneksi</span></div>
  <div class="panel-b">
    <form method="post" action="/providers/add" class="form-grid">
      <div class="field"><label>Provider</label>
        <select name="provider">{opts}</select></div>
      <div class="field"><label>API Key</label>
        <input type="password" name="apiKey" placeholder="sk-..." autocomplete="off"></div>
      <div class="field"><label>Base URL (opsional)</label>
        <input type="text" name="baseUrl" placeholder="https://..."></div>
      <div class="field"><label>&nbsp;</label>
        <button class="btn primary" type="submit">{ic("plus")}Simpan</button></div>
    </form>
  </div>
</div>"""
    return layout("Providers", body, "providers", user)


def page_keys(user):
    keys = db.list_api_keys()
    if keys:
        rows = "".join(
            f'<tr><td class="lead">{k["key"][:10]}...{k["key"][-4:]}</td><td>{k["name"]}</td>'
            f'<td>{k["usedTokens"]:,}</td><td>{k["lastUsedAt"] or "never"}</td>'
            f'<td><span class="pill {"on" if k["isActive"] else "off"}">'
            f'{"aktif" if k["isActive"] else "mati"}</span></td></tr>'
            for k in keys
        )
    else:
        rows = ('<tr><td colspan="5"><div class="empty">'
                f'{ic("empty", "ic empty-ic")}<div>Belum ada API key.</div>'
                "</div></td></tr>")
    body = f"""
<div class="topbar">
  <h1>API Keys <span>//</span></h1>
  <div class="sub">bearer buat /v1</div>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Keys</span>
    <form method="post" action="/keys/new">
      <button class="btn primary">{ic("plus")}Generate</button></form>
  </div>
  <table>
    <thead><tr><th>Key</th><th>Nama</th><th>Tokens</th><th>Terakhir</th><th>Status</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</div>"""
    return layout("API Keys", body, "keys", user)


def page_logs(user):
    s = db.stats()
    recent = s["recent"]
    if recent:
        rows = "".join(
            f'<tr><td class="lead">{r["model"] or "-"}</td><td>{r["provider"] or "-"}</td>'
            f'<td>{r["endpoint"] or "-"}</td>'
            f'<td><span class="pill {"on" if r["status"] == "ok" else "off"}">{r["status"]}</span></td>'
            f'<td>{r["latencyMs"]} ms</td><td>{r["timestamp"]}</td></tr>'
            for r in recent
        )
    else:
        rows = ('<tr><td colspan="6"><div class="empty">'
                f'{ic("empty", "ic empty-ic")}<div>Log kosong.</div></div></td></tr>')
    body = f"""
<div class="topbar">
  <h1>Logs <span>//</span></h1>
  <div class="sub">{s['requests']} request</div>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Usage history</span></div>
  <table>
    <thead><tr><th>Model</th><th>Provider</th><th>Endpoint</th><th>Status</th><th>Latency</th><th>Waktu</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</div>"""
    return layout("Logs", body, "logs", user)


# ---------------------------------------------------------------- handler

class Handler(BaseHTTPRequestHandler):
    server_version = "xrouter/0.1"
    protocol_version = "HTTP/1.1"

    # ---- plumbing
    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def _cookies(self):
        jar = http_cookies.SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
        except http_cookies.CookieError:
            return {}
        return {k: v.value for k, v in jar.items()}

    def _sess(self):
        return db.session_user(self._cookies().get("xr_session", ""))

    def _send(self, code, body: bytes, ctype="text/html; charset=utf-8", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _html(self, code, html):
        self._send(code, html.encode())

    def _json(self, code, obj):
        self._send(code, json.dumps(obj).encode(),
                   "application/json; charset=utf-8")

    def _redirect(self, loc, extra=None):
        self.send_response(302)
        self.send_header("Location", loc)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def _authed(self):
        return self._sess() is not None

    def _require(self):
        if self._authed():
            return True
        self._redirect("/login")
        return False

    def _api_key(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:].strip()
        x = self.headers.get("x-api-key", "")
        return x.strip()

    def _static(self, path):
        name = os.path.basename(path)
        fpath = os.path.join(STATIC_DIR, name)
        if not os.path.isfile(fpath):
            self._html(404, "<h1>404</h1>")
            return
        with open(fpath, "rb") as f:
            self._send(200, f.read(),
                       MIME.get(os.path.splitext(name)[1], "application/octet-stream"))

    # ---- GET
    def do_GET(self):
        path = urlparse(self.path).path

        if path.startswith("/static/"):
            return self._static(path)
        if path == "/health":
            return self._json(200, {"ok": True, "service": "x-router", "version": "0.1.0"})
        if path == "/login":
            if self._authed():
                return self._redirect("/dashboard")
            return self._html(200, login_page())
        if path == "/logout":
            tok = self._cookies().get("xr_session", "")
            if tok:
                db.drop_session(tok)
            return self._redirect(
                "/login",
                {"Set-Cookie": "xr_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"})

        # ---- API
        if path == "/v1/models":
            return self._handle_models()

        if path.startswith("/v1/"):
            return self._json(405, {"error": {
                "message": f"GET tidak didukung untuk {path}", "type": "method_not_allowed"}})

        # ---- dashboard
        if path in ("/", "/dashboard"):
            if not self._require():
                return
            return self._html(200, page_dashboard(self._sess()))
        if path == "/providers":
            if not self._require():
                return
            return self._html(200, page_providers(self._sess()))
        if path == "/keys":
            if not self._require():
                return
            return self._html(200, page_keys(self._sess()))
        if path == "/logs":
            if not self._require():
                return
            return self._html(200, page_logs(self._sess()))
        self._html(404, "<h1>404</h1>")

    def _handle_models(self):
        key = self._api_key()
        if not db.check_api_key(key):
            return self._json(401, {"error": {"message": "invalid api key",
                                               "type": "authentication_error"}})
        provs = registry()
        active = {c["provider"] for c in db.list_connections()}
        data = [
            {"id": m["id"], "object": "model", "owned_by": p["alias"]}
            for p in provs if p["id"] in active
            for m in p["models"]
        ]
        # format anthropic kalau x-api-key dipakai
        if self.headers.get("x-api-key") and not self.headers.get("Authorization"):
            return self._json(200, {
                "data": [{"id": m["id"], "display_name": m.get("name") or m["id"],
                          "created_at": "2026-01-01T00:00:00Z"}
                         for m in
                         [{"id": d["id"]} for d in data]],
                "has_more": False, "first_id": data[0]["id"] if data else None,
                "last_id": data[-1]["id"] if data else None})
        return self._json(200, {"object": "list", "data": data})

    # ---- POST
    def do_POST(self):
        path = urlparse(self.path).path
        raw = self._body()

        if path == "/login":
            form = parse_qs(raw.decode("utf-8", "replace"))
            p = (form.get("password") or [""])[0]
            # login password-only: cek ke akun admin tunggal
            if p and db.verify_pw("admin", p):
                c = db.conn()
                row = c.execute("SELECT id FROM users WHERE username='admin'").fetchone()
                c.close()
                tok = db.create_session(row["id"])
                return self._redirect("/dashboard", {"Set-Cookie":
                    f"xr_session={tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age={db.SESSION_TTL}"})
            return self._html(401, login_page("Password salah."))

        if path == "/logout":
            return self._redirect("/login")

        # dashboard POSTs (hanya path dashboard; /v1 jangan di-gate session)
        if path.startswith("/keys/") or path.startswith("/providers/"):
            if not self._require():
                return
            if path == "/keys/new":
                db.new_api_key()
                return self._redirect("/keys")
            if path == "/providers/add":
                form = parse_qs(raw.decode("utf-8", "replace"))
                pid = (form.get("provider") or [""])[0]
                key = (form.get("apiKey") or [""])[0].strip()
                bu = (form.get("baseUrl") or [""])[0].strip()
                if pid and key:
                    import secrets as _s
                    data = {"apiKey": key}
                    if bu:
                        data["baseUrl"] = bu
                    db.upsert_connection("conn-" + _s.token_hex(6), pid, data)
                return self._redirect("/providers")
            if path == "/providers/delete":
                form = parse_qs(raw.decode("utf-8", "replace"))
                cid = (form.get("id") or [""])[0]
                if cid:
                    db.delete_connection(cid)
                return self._redirect("/providers")

        # ---- API
        if path == "/v1/chat/completions":
            return self._handle_chat(raw, "openai")
        if path == "/v1/completions":
            return self._handle_chat(raw, "openai", kind="completions")
        if path == "/v1/embeddings":
            return self._handle_chat(raw, "openai", kind="embeddings")
        if path == "/v1/messages":
            return self._handle_chat(raw, "anthropic")
        if path == "/v1/messages/count_tokens":
            return self._handle_count_tokens(raw)
        if path.startswith("/v1/"):
            return self._json(404, {"error": {
                "message": f"endpoint {path} belum ada", "type": "not_found"}})
        self._html(404, "<h1>404</h1>")

    def _handle_chat(self, raw, client_format, kind="chat"):
        t0 = time.time()
        key = self._api_key()
        if not db.check_api_key(key):
            return self._json(401, {"error": {
                "message": "invalid api key", "type": "authentication_error"}})
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": {
                "message": "invalid json body", "type": "invalid_request_error"}})

        model = payload.get("model")
        p, up_model = resolve_model(model)
        if p is None:
            return self._json(404, {"error": {
                "message": f"model '{model}' tidak dikenal / provider belum aktif",
                "type": "not_found"}})

        conn_row = pick_connection(p["id"])
        if conn_row is None:
            return self._json(503, {"error": {
                "message": f"provider '{p['name']}' belum punya koneksi aktif",
                "type": "unavailable"}})

        # rewrite model id ke upstream
        if up_model and up_model != model:
            payload = dict(payload)
            payload["model"] = up_model

        url = upstream_url(p, "chat" if kind == "chat" else kind, client_format)
        # custom baseUrl dari connection menang
        cbu = (conn_row.get("data") or {}).get("baseUrl")
        if cbu:
            base = cbu.rstrip("/")
            if kind == "chat":
                url = (base if _endswith(base, "/messages") or _endswith(base, "/chat/completions")
                       else base + ("/messages" if p.get("format") == "claude" else "/chat/completions"))

        hdrs = build_upstream_headers(p, conn_row, for_anthropic=(client_format == "anthropic"))
        body = json.dumps(payload).encode()

        # auth check upstream pertama kali? tidak — langsung relay (biar hemat roundtrip)
        use_stream = bool(payload.get("stream"))
        is_anthropic = client_format == "anthropic"

        if use_stream:
            self.send_response(200)
            self.send_header("Content-Type",
                             "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()
            self.close_connection = True

            def send(chunk: bytes):
                try:
                    self.wfile.write(chunk)
                    self.wfile.flush()
                except Exception:
                    raise BrokenPipeError

            try:
                code, data, rhdrs = http_exchange("POST", url, hdrs, body, send)
            except BrokenPipeError:
                db.log_usage(p["id"], model, "chat", "client_gone",
                             int((time.time() - t0) * 1000))
                return
            if data is not None:  # upstream nggak stream beneran
                try:
                    self.wfile.write(data)
                    self.wfile.flush()
                except Exception:
                    pass
                code = 200
            db.log_usage(p["id"], model, "chat", "ok",
                         int((time.time() - t0) * 1000),
                         completion_tokens=_count_tokens(data))
            return

        code, data, rhdrs = http_exchange("POST", url, hdrs, body, None)
        status = "ok" if code < 400 else f"http_{code}"
        pt, ct = _usage_from(data)
        db.log_usage(p["id"], model, "chat", status,
                     int((time.time() - t0) * 1000), pt, ct)
        if data is None:
            data = b""
        ctype = rhdrs.get("Content-Type", "application/json; charset=utf-8")
        self._send(code if code < 600 else 502, data, ctype)

    def _handle_count_tokens(self, raw):
        key = self._api_key()
        if not db.check_api_key(key):
            return self._json(401, {"error": {
                "message": "invalid api key", "type": "authentication_error"}})
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return self._json(400, {"error": {
                "message": "invalid json body", "type": "invalid_request_error"}})
        # estimasi kasar: ~4 char/token
        msgs = payload.get("messages") or []
        text = " ".join(
            (m.get("content") if isinstance(m.get("content"), str)
             else json.dumps(m.get("content")))
            for m in msgs if isinstance(m, dict))
        est = max(1, len(text) // 4)
        return self._json(200, {"input_tokens": est})


def _usage_from(data: bytes):
    try:
        obj = json.loads(data)
        u = obj.get("usage") or {}
        return int(u.get("prompt_tokens") or 0), int(u.get("completion_tokens") or 0)
    except Exception:
        return 0, 0


def _count_tokens(data):
    if not data:
        return 0
    _, ct = _usage_from(data)
    return ct


# ---------------------------------------------------------------- main

def main():
    db.init()
    gen = db.ensure_admin()
    if gen:
        print(f"[x-router] password admin awal: {gen}")
    reg = db.load_registry()
    print(f"[x-router] registry: {len(reg)} provider, "
          f"{sum(len(p.get('models') or []) for p in reg)} model")
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    srv.daemon_threads = True
    print(f"[x-router] listening on {HOST}:{PORT}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[x-router] bye")


if __name__ == "__main__":
    main()
