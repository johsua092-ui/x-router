#!/usr/bin/env python3
"""
X Router — foundation server.
OpenAI-compatible LLM router with session login.

Stdlib only (no pip deps) per api-router-proxy-cloning skill:
  python3 server.py            # default :20130
  XR_PORT=20140 python3 server.py
"""

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
from http import cookies as http_cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

# ---------------------------------------------------------------- config

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")
DB_PATH = os.path.join(DATA_DIR, "xrouter.db")
CONF_PATH = os.path.join(DATA_DIR, "config.json")

PORT = int(os.environ.get("XR_PORT", "20130"))
HOST = os.environ.get("XR_HOST", "0.0.0.0")
SESSION_TTL = 60 * 60 * 12  # 12h

DEFAULT_CONF = {
    "site_name": "X Router",
    "default_provider": None,
    "providers": [],  # filled by LO later: {name, base_url, key_env, models: []}
}

MIME = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8",
}

_db_lock = threading.Lock()


# ---------------------------------------------------------------- storage

def db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    c = db()
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            pass_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS api_keys (
            key TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            last_used INTEGER
        );
        """
    )
    c.commit()
    c.close()


def load_conf():
    if not os.path.exists(CONF_PATH):
        with open(CONF_PATH, "w") as f:
            json.dump(DEFAULT_CONF, f, indent=2)
        return dict(DEFAULT_CONF)
    with open(CONF_PATH) as f:
        return json.load(f)


def save_conf(conf):
    with open(CONF_PATH, "w") as f:
        json.dump(conf, f, indent=2)


# ---------------------------------------------------------------- password / session

def hash_pw(pw: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()


def ensure_admin():
    c = db()
    row = c.execute("SELECT 1 FROM users LIMIT 1").fetchone()
    if row:
        c.close()
        return
    pw = os.environ.get("XR_ADMIN_PW")
    generated = None
    if not pw:
        generated = secrets.token_urlsafe(9)
        pw = generated
    salt = secrets.token_hex(16)
    c.execute(
        "INSERT INTO users (username, pass_hash, salt, created_at) VALUES (?,?,?,?)",
        ("admin", hash_pw(pw, salt), salt, int(time.time())),
    )
    c.commit()
    c.close()
    if generated:
        print(f"[x-router] admin password (simpan ini): {generated}")


def verify_pw(username: str, pw: str) -> bool:
    c = db()
    row = c.execute(
        "SELECT pass_hash, salt FROM users WHERE username = ?", (username,)
    ).fetchone()
    c.close()
    if not row:
        return False
    return hmac.compare_digest(hash_pw(pw, row["salt"]), row["pass_hash"])


def create_session(user_id: int) -> str:
    tok = secrets.token_urlsafe(32)
    c = db()
    c.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
        (tok, user_id, int(time.time()) + SESSION_TTL),
    )
    c.commit()
    c.close()
    return tok


def session_user(token: str):
    if not token:
        return None
    c = db()
    row = c.execute(
        "SELECT u.username FROM sessions s JOIN users u ON u.id = s.user_id "
        "WHERE s.token = ? AND s.expires_at > ?",
        (token, int(time.time())),
    ).fetchone()
    c.close()
    return row["username"] if row else None


def drop_session(token: str):
    c = db()
    c.execute("DELETE FROM sessions WHERE token = ?", (token,))
    c.commit()
    c.close()


def check_api_key(key: str) -> bool:
    if not key:
        return False
    c = db()
    row = c.execute("SELECT 1 FROM api_keys WHERE key = ?", (key,)).fetchone()
    if row:
        c.execute(
            "UPDATE api_keys SET last_used = ? WHERE key = ?",
            (int(time.time()), key),
        )
        c.commit()
    c.close()
    return bool(row)


# ---------------------------------------------------------------- pages

def page(title: str, body: str, active: str = "", user: str = "") -> str:
    nav = [
        ("dashboard", "Dashboard", "01"),
        ("providers", "Providers", "02"),
        ("keys", "API Keys", "03"),
        ("logs", "Logs", "04"),
    ]
    items = "".join(
        f'<a class="nav-item {"active" if k == active else ""}" href="/{k}">'
        f'<span class="dot"></span>{label}</a>'
        for k, label, _ in nav
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · X Router</title>
<link rel="stylesheet" href="/static/style.css">
<link rel="icon" href="/static/logo.png" type="image/png">
</head>
<body>
<div class="shell">
  <aside class="sidebar">
    <div class="brand">
      <img src="/static/logo.png" alt="X Router">
      <div class="name">X<b>Router</b></div>
    </div>
    <div class="nav-label">Menu</div>
    {items}
    <div class="foot">
      <a class="nav-item" href="/logout"><span class="dot"></span>Logout ({user})</a>
    </div>
  </aside>
  <main class="main">{body}</main>
</div>
</body>
</html>"""


def login_page(msg: str = "") -> str:
    alert = f'<div class="alert err">{msg}</div>' if msg else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Login · X Router</title>
<link rel="stylesheet" href="/static/style.css">
<link rel="icon" href="/static/logo.png" type="image/png">
</head>
<body>
<div class="auth-wrap">
  <div class="auth-card">
    <div class="auth-brand">
      <img src="/static/logo.png" alt="X Router">
      <div class="name">X<b>Router</b></div>
      <div class="tag">llm gateway</div>
    </div>
    {alert}
    <form method="post" action="/login">
      <div class="field">
        <label>Username</label>
        <input type="text" name="username" autocomplete="username" autofocus>
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" name="password" autocomplete="current-password">
      </div>
      <button class="btn primary" style="width:100%;justify-content:center" type="submit">Sign in</button>
    </form>
    <div class="hint">session 12 jam · pbkdf2-sha256</div>
  </div>
</div>
</body>
</html>"""


def render_dashboard(conf, user):
    provs = conf.get("providers") or []
    rows = "".join(
        f'<tr><td class="lead">{p.get("name")}</td><td>{p.get("base_url")}</td>'
        f'<td><span class="pill off">belum aktif</span></td></tr>'
        for p in provs
    )
    if not rows:
        rows = (
            '<tr><td colspan="3"><div class="empty">'
            '<img src="/static/logo.png" alt="">'
            '<div>Belum ada provider.<br>Tambahin nanti lewat config — bagian lo. 🙂</div>'
            "</div></td></tr>"
        )
    c = db()
    nkeys = c.execute("SELECT COUNT(*) n FROM api_keys").fetchone()["n"]
    c.close()
    body = f"""
<div class="topbar">
  <h1>Dashboard <span>//</span></h1>
  <div class="sub">x-router v0.1.0 · foundation</div>
</div>
<div class="stats">
  <div class="stat"><div class="k">Providers</div><div class="v hot">{len(provs)}</div><div class="m">terkonfigurasi</div></div>
  <div class="stat"><div class="k">API Keys</div><div class="v">{nkeys}</div><div class="m">aktif</div></div>
  <div class="stat"><div class="k">Uptime</div><div class="v ok">ok</div><div class="m">gateway hidup</div></div>
  <div class="stat"><div class="k">Port</div><div class="v">{PORT}</div><div class="m">listening</div></div>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Providers</span><a class="btn ghost" href="/providers">Kelola</a></div>
  <table>
    <thead><tr><th>Nama</th><th>Base URL</th><th>Status</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Endpoint</span></div>
  <div class="panel-b">
    <div class="log"><span class="t">POST</span> <span class="hot">/v1/chat/completions</span>
<span class="t">GET </span> <span class="hot">/v1/models</span>
<span class="t">GET </span> <span class="hot">/health</span></div>
  </div>
</div>"""
    return page("Dashboard", body, "dashboard", user)


def render_providers(conf, user):
    provs = conf.get("providers") or []
    if provs:
        rows = "".join(
            f'<tr><td class="lead">{p.get("name")}</td><td>{p.get("base_url")}</td>'
            f'<td>{len(p.get("models") or [])}</td>'
            f'<td><span class="pill on">siap</span></td></tr>'
            for p in provs
        )
    else:
        rows = (
            '<tr><td colspan="4"><div class="empty">'
            '<img src="/static/logo.png" alt="">'
            "<div>Providers kosong — routing engine nunggu diisi.</div>"
            "</div></td></tr>"
        )
    body = f"""
<div class="topbar">
  <h1>Providers <span>//</span></h1>
  <div class="sub">multi-upstream · auto-route by model id</div>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Upstream</span></div>
  <table>
    <thead><tr><th>Nama</th><th>Base URL</th><th>Models</th><th>Status</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Cara kerja (rencana)</span></div>
  <div class="panel-b">
    <div class="log"><span class="t">client</span> → model id <span class="hot">"&lt;provider&gt;-&lt;model&gt;"</span>
<span class="t">      ↓</span> namespace match (pakai delimiter "-", bukan prefix longgar)
<span class="t">      ↓</span> upstream dipilih SEBELUM resource acquisition
<span class="t">      ↓</span> request diteruskan apa adanya (field jangan di-strip)</div>
  </div>
</div>"""
    return page("Providers", body, "providers", user)


def render_keys(user):
    c = db()
    ks = c.execute(
        "SELECT key, label, created_at, last_used FROM api_keys ORDER BY created_at DESC"
    ).fetchall()
    c.close()
    if ks:
        rows = "".join(
            f'<tr><td class="lead">xr-{k["key"][:6]}…{k["key"][-4:]}</td>'
            f'<td>{k["label"]}</td><td>{"never" if not k["last_used"] else "yes"}</td></tr>'
            for k in ks
        )
    else:
        rows = (
            '<tr><td colspan="3"><div class="empty">'
            '<img src="/static/logo.png" alt="">'
            "<div>Belum ada API key.</div></div></td></tr>"
        )
    body = f"""
<div class="topbar">
  <h1>API Keys <span>//</span></h1>
  <div class="sub">bearer token buat /v1/*</div>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Keys</span>
    <form method="post" action="/keys/new"><button class="btn primary">+ Generate</button></form>
  </div>
  <table>
    <thead><tr><th>Key</th><th>Label</th><th>Dipakai</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</div>"""
    return page("API Keys", body, "keys", user)


def render_logs(user):
    body = """
<div class="topbar">
  <h1>Logs <span>//</span></h1>
  <div class="sub">request log — menyusul</div>
</div>
<div class="panel">
  <div class="panel-h"><span class="t">Recent</span></div>
  <div class="panel-b">
    <div class="log"><span class="t">—</span> belum ada request masuk.</div>
  </div>
</div>"""
    return page("Logs", body, "logs", user)


# ---------------------------------------------------------------- router (stub)

def route_model(model: str):
    """Namespace match with explicit delimiter. Returns provider dict or None."""
    provs = load_conf().get("providers") or []
    if not model:
        return None
    m = model.lower()
    for p in provs:
        prefix = str(p.get("name", "")).lower() + "-"
        if prefix and m.startswith(prefix):
            return p
    return None


# ---------------------------------------------------------------- handler

class Handler(BaseHTTPRequestHandler):
    server_version = "x-router/0.1"

    # ---- plumbing
    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def _cookies(self):
        raw = self.headers.get("Cookie", "")
        jar = http_cookies.SimpleCookie()
        try:
            jar.load(raw)
        except http_cookies.CookieError:
            return {}
        return {k: v.value for k, v in jar.items()}

    def _sess(self):
        return session_user(self._cookies().get("xr_session", ""))

    def _send(self, code: int, body: bytes, ctype: str = "text/html; charset=utf-8", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code: int, html: str):
        self._send(code, html.encode())

    def _json(self, code: int, obj):
        self._send(code, json.dumps(obj).encode(), "application/json; charset=utf-8")

    def _redirect(self, loc: str, extra=None):
        self.send_response(302)
        self.send_header("Location", loc)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def _authed(self) -> bool:
        return self._sess() is not None

    def _require_auth(self) -> bool:
        if self._authed():
            return True
        self._redirect("/login")
        return False

    # ---- static
    def _static(self, path: str):
        name = os.path.basename(path)
        fpath = os.path.join(STATIC_DIR, name)
        if not os.path.isfile(fpath):
            self._html(404, "not found")
            return
        ext = os.path.splitext(name)[1]
        with open(fpath, "rb") as f:
            self._send(200, f.read(), MIME.get(ext, "application/octet-stream"))

    # ---- GET
    def do_GET(self):
        u = urlparse(self.path)
        path = u.path

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
                drop_session(tok)
            return self._redirect(
                "/login", {"Set-Cookie": "xr_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"}
            )

        # ---- OpenAI-compatible (API key auth)
        if path == "/v1/models":
            auth = self.headers.get("Authorization", "")
            key = auth[7:] if auth.startswith("Bearer ") else ""
            if not check_api_key(key):
                return self._json(401, {"error": {"message": "invalid api key", "type": "auth_error"}})
            conf = load_conf()
            data = [
                {"id": m, "object": "model", "owned_by": p.get("name")}
                for p in (conf.get("providers") or [])
                for m in (p.get("models") or [])
            ]
            return self._json(200, {"object": "list", "data": data})

        if path.startswith("/v1/"):
            auth = self.headers.get("Authorization", "")
            key = auth[7:] if auth.startswith("Bearer ") else ""
            if not check_api_key(key):
                return self._json(401, {"error": {"message": "invalid api key", "type": "auth_error"}})
            return self._json(
                501,
                {"error": {"message": "routing engine belum diisi — providers menyusul", "type": "not_implemented"}},
            )

        # ---- dashboard pages
        if path in ("/", "/dashboard"):
            if not self._require_auth():
                return
            return self._html(200, render_dashboard(load_conf(), self._sess()))

        if path == "/providers":
            if not self._require_auth():
                return
            return self._html(200, render_providers(load_conf(), self._sess()))

        if path == "/keys":
            if not self._require_auth():
                return
            return self._html(200, render_keys(self._sess()))

        if path == "/logs":
            if not self._require_auth():
                return
            return self._html(200, render_logs(self._sess()))

        self._html(404, "<h1>404</h1>")

    # ---- POST
    def do_POST(self):
        u = urlparse(self.path)
        path = u.path
        raw = self._body()

        if path == "/login":
            form = parse_qs(raw.decode("utf-8", "replace"))
            username = (form.get("username") or [""])[0].strip()
            password = (form.get("password") or [""])[0]
            if verify_pw(username, password):
                c = db()
                row = c.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
                c.close()
                tok = create_session(row["id"])
                return self._redirect(
                    "/dashboard",
                    {
                        "Set-Cookie": (
                            f"xr_session={tok}; Path=/; HttpOnly; SameSite=Lax; "
                            f"Max-Age={SESSION_TTL}"
                        )
                    },
                )
            return self._html(401, login_page("Username / password salah."))

        if path == "/keys/new":
            if not self._require_auth():
                return
            tok = secrets.token_hex(24)
            c = db()
            c.execute(
                "INSERT INTO api_keys (key, label, created_at) VALUES (?,?,?)",
                (tok, "default", int(time.time())),
            )
            c.commit()
            c.close()
            return self._redirect("/keys")

        # ---- OpenAI-compatible writes
        if path.startswith("/v1/"):
            auth = self.headers.get("Authorization", "")
            key = auth[7:] if auth.startswith("Bearer ") else ""
            if not check_api_key(key):
                return self._json(401, {"error": {"message": "invalid api key", "type": "auth_error"}})
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except json.JSONDecodeError:
                return self._json(400, {"error": {"message": "invalid json body", "type": "invalid_request_error"}})
            model = payload.get("model")
            prov = route_model(model)
            if prov is None:
                return self._json(
                    404,
                    {
                        "error": {
                            "message": f"no provider configured for model '{model}'",
                            "type": "not_found",
                        }
                    },
                )
            # forward ke upstream — menyusul pas provider diisi
            return self._json(
                501,
                {"error": {"message": f"provider '{prov.get('name')}' kepasang, forwarding menyusul", "type": "not_implemented"}},
            )

        self._html(404, "<h1>404</h1>")


# ---------------------------------------------------------------- main

def main():
    init_db()
    ensure_admin()
    conf = load_conf()
    save_conf(conf)
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[x-router] listening on {HOST}:{PORT}  (dashboard: / , api: /v1)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[x-router] bye")


if __name__ == "__main__":
    main()
