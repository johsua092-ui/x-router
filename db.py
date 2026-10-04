"""X Router — SQLite layer.

Skema disamain gaya 9router (fork johsua092-ui/9router, src/lib/db/schema.js):
providerConnections / apiKeys / usageHistory / requestDetails / kv,
ditambah users+sessions buat login dashboard.
"""

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "xrouter.db")
REGISTRY_PATH = os.path.join(DATA_DIR, "registry.json")

_lock = threading.Lock()

SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS _meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

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

-- gaya 9router: koneksi upstream per provider (bisa banyak akun)
CREATE TABLE IF NOT EXISTS providerConnections (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    authType TEXT NOT NULL DEFAULT 'apikey',
    name TEXT,
    priority INTEGER DEFAULT 100,
    isActive INTEGER DEFAULT 1,
    data TEXT NOT NULL DEFAULT '{}',   -- {apiKey, baseUrl?, models?}
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pc_provider ON providerConnections(provider);
CREATE INDEX IF NOT EXISTS idx_pc_active ON providerConnections(provider, isActive);

CREATE TABLE IF NOT EXISTS apiKeys (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL,
    tokenLimit INTEGER DEFAULT 0,
    usedTokens INTEGER DEFAULT 0,
    allowedModels TEXT DEFAULT '*',
    lastUsedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_ak_key ON apiKeys(key);

CREATE TABLE IF NOT EXISTS usageHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    connectionId TEXT,
    endpoint TEXT,
    promptTokens INTEGER DEFAULT 0,
    completionTokens INTEGER DEFAULT 0,
    status TEXT,
    latencyMs INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_uh_ts ON usageHistory(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_uh_model ON usageHistory(model);

CREATE TABLE IF NOT EXISTS requestDetails (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    connectionId TEXT,
    status TEXT,
    data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rd_ts ON requestDetails(timestamp DESC);

CREATE TABLE IF NOT EXISTS kv (
    scope TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (scope, key)
);
"""


def conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH, timeout=5)
    c.row_factory = sqlite3.Row
    return c


def init():
    os.makedirs(DATA_DIR, exist_ok=True)
    with _lock:
        c = conn()
        c.executescript(SCHEMA)
        c.execute(
            "INSERT OR IGNORE INTO _meta(key, value) VALUES ('schema_version', '1')"
        )
        c.commit()
        c.close()


# --------------------------------------------------------------- auth

def hash_pw(pw: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()


def ensure_admin() -> str | None:
    """Return generated password kalau user pertama dibuat."""
    c = conn()
    if c.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        c.close()
        return None
    generated = os.environ.get("XR_ADMIN_PW") or secrets.token_urlsafe(9)
    salt = secrets.token_hex(16)
    c.execute(
        "INSERT INTO users (username, pass_hash, salt, created_at) VALUES (?,?,?,?)",
        ("admin", hash_pw(generated, salt), salt, int(time.time())),
    )
    c.commit()
    c.close()
    return None if os.environ.get("XR_ADMIN_PW") else generated


def verify_pw(username: str, pw: str) -> bool:
    c = conn()
    row = c.execute(
        "SELECT pass_hash, salt FROM users WHERE username=?", (username,)
    ).fetchone()
    c.close()
    if not row:
        return False
    return hmac.compare_digest(hash_pw(pw, row["salt"]), row["pass_hash"])


SESSION_TTL = 60 * 60 * 12


def create_session(user_id: int) -> str:
    tok = secrets.token_urlsafe(32)
    c = conn()
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
    c = conn()
    row = c.execute(
        "SELECT u.username FROM sessions s JOIN users u ON u.id=s.user_id "
        "WHERE s.token=? AND s.expires_at>?",
        (token, int(time.time())),
    ).fetchone()
    c.close()
    return row["username"] if row else None


def drop_session(token: str):
    c = conn()
    c.execute("DELETE FROM sessions WHERE token=?", (token,))
    c.commit()
    c.close()


# --------------------------------------------------------------- api keys

def new_api_key(name: str = "default") -> str:
    tok = "xr-" + secrets.token_hex(20)
    c = conn()
    c.execute(
        "INSERT INTO apiKeys (id, key, name, createdAt) VALUES (?,?,?,?)",
        (secrets.token_hex(8), tok, name, time.strftime("%Y-%m-%dT%H:%M:%SZ")),
    )
    c.commit()
    c.close()
    return tok


def list_api_keys():
    c = conn()
    rows = c.execute(
        "SELECT key,name,isActive,createdAt,lastUsedAt,usedTokens FROM apiKeys ORDER BY createdAt DESC"
    ).fetchall()
    c.close()
    return [dict(r) for r in rows]


def check_api_key(key: str) -> bool:
    if not key:
        return False
    with _lock:
        c = conn()
        row = c.execute(
            "SELECT isActive, tokenLimit, usedTokens FROM apiKeys WHERE key=?",
            (key,),
        ).fetchone()
        if row and row["isActive"] and (
            row["tokenLimit"] == 0 or row["usedTokens"] < row["tokenLimit"]
        ):
            c.execute(
                "UPDATE apiKeys SET lastUsedAt=? WHERE key=?",
                (time.strftime("%Y-%m-%dT%H:%M:%SZ"), key),
            )
            c.commit()
            c.close()
            return True
        c.close()
        return False


def add_tokens(key: str, n: int):
    if n <= 0:
        return
    with _lock:
        c = conn()
        c.execute("UPDATE apiKeys SET usedTokens=usedTokens+? WHERE key=?", (n, key))
        c.commit()
        c.close()


def revoke_api_key(key: str):
    with _lock:
        c = conn()
        c.execute("UPDATE apiKeys SET isActive=0 WHERE key=?", (key,))
        c.commit()
        c.close()


def rename_api_key(key: str, name: str, token_limit: int | None = None):
    with _lock:
        c = conn()
        if token_limit is None:
            c.execute("UPDATE apiKeys SET name=? WHERE key=?", (name, key))
        else:
            c.execute("UPDATE apiKeys SET name=?, tokenLimit=? WHERE key=?",
                      (name, token_limit, key))
        c.commit()
        c.close()


def first_key() -> str | None:
    c = conn()
    row = c.execute(
        "SELECT key FROM apiKeys WHERE isActive=1 ORDER BY createdAt ASC LIMIT 1"
    ).fetchone()
    c.close()
    return row["key"] if row else None


# --------------------------------------------------------------- providers

def list_connections(provider: str | None = None, active_only=True):
    q = "SELECT * FROM providerConnections"
    args: list = []
    conds = []
    if provider:
        conds.append("provider=?")
        args.append(provider)
    if active_only:
        conds.append("isActive=1")
    if conds:
        q += " WHERE " + " AND ".join(conds)
    q += " ORDER BY priority ASC, createdAt ASC"
    c = conn()
    rows = c.execute(q, args).fetchall()
    c.close()
    out = []
    for r in rows:
        d = dict(r)
        d["data"] = json.loads(d.get("data") or "{}")
        out.append(d)
    return out


def upsert_connection(cid, provider, data, name=None, priority=100, active=True):
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ")
    c = conn()
    c.execute(
        "INSERT INTO providerConnections (id,provider,name,priority,isActive,data,createdAt,updatedAt) "
        "VALUES (?,?,?,?,?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET name=excluded.name, priority=excluded.priority, "
        "isActive=excluded.isActive, data=excluded.data, updatedAt=excluded.updatedAt",
        (cid, provider, name or provider, priority, 1 if active else 0,
         json.dumps(data), now, now),
    )
    c.commit()
    c.close()


def delete_connection(cid):
    c = conn()
    c.execute("DELETE FROM providerConnections WHERE id=?", (cid,))
    c.commit()
    c.close()


def load_registry() -> list:
    for path in (REGISTRY_PATH, os.path.join(BASE_DIR, "registry", "providers.json")):
        if os.path.exists(path):
            with open(path) as f:
                return json.load(f)
    return []


# --------------------------------------------------------------- usage

def log_usage(provider, model, endpoint, status, latency_ms,
              prompt_tokens=0, completion_tokens=0, connection_id=None):
    c = conn()
    c.execute(
        "INSERT INTO usageHistory (timestamp,provider,model,connectionId,endpoint,"
        "promptTokens,completionTokens,status,latencyMs) VALUES (?,?,?,?,?,?,?,?,?)",
        (time.strftime("%Y-%m-%dT%H:%M:%SZ"), provider, model, connection_id,
         endpoint, prompt_tokens, completion_tokens, status, latency_ms),
    )
    c.commit()
    c.close()


def stats():
    c = conn()
    n_keys = c.execute("SELECT COUNT(*) n FROM apiKeys").fetchone()["n"]
    n_conn = c.execute(
        "SELECT COUNT(*) n FROM providerConnections WHERE isActive=1"
    ).fetchone()["n"]
    reqs = c.execute("SELECT COUNT(*) n FROM usageHistory").fetchone()["n"]
    ok = c.execute(
        "SELECT COUNT(*) n FROM usageHistory WHERE status='ok'"
    ).fetchone()["n"]
    tokens = c.execute(
        "SELECT COALESCE(SUM(promptTokens+completionTokens),0) n FROM usageHistory"
    ).fetchone()["n"]
    recent = c.execute(
        "SELECT timestamp,provider,model,endpoint,status,latencyMs,promptTokens,"
        "completionTokens FROM usageHistory ORDER BY id DESC LIMIT 40"
    ).fetchall()
    c.close()
    return {
        "keys": n_keys,
        "connections": n_conn,
        "requests": reqs,
        "ok": ok,
        "tokens": tokens,
        "recent": [dict(r) for r in recent],
    }


def usage_daily(days: int = 14):
    """Token per hari (UTC) — buat bar chart."""
    c = conn()
    rows = c.execute(
        "SELECT substr(timestamp,1,10) AS day, COUNT(*) AS reqs,"
        " COALESCE(SUM(promptTokens),0) AS pt, COALESCE(SUM(completionTokens),0) AS ct "
        "FROM usageHistory WHERE timestamp >= datetime('now', ?) "
        "GROUP BY day ORDER BY day ASC",
        (f"-{days} days",),
    ).fetchall()
    c.close()
    return [dict(r) for r in rows]


def top_models(limit: int = 10):
    c = conn()
    rows = c.execute(
        "SELECT model, provider, COUNT(*) AS reqs,"
        " COALESCE(SUM(promptTokens+completionTokens),0) AS tokens, "
        "COALESCE(ROUND(AVG(latencyMs)),0) AS avg_ms "
        "FROM usageHistory WHERE model IS NOT NULL "
        "GROUP BY model, provider ORDER BY reqs DESC LIMIT ?",
        (limit,),
    ).fetchall()
    c.close()
    return [dict(r) for r in rows]


def provider_breakdown(limit: int = 12):
    c = conn()
    rows = c.execute(
        "SELECT provider, COUNT(*) AS reqs,"
        " COALESCE(SUM(promptTokens+completionTokens),0) AS tokens, "
        "COALESCE(SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END),0) AS ok "
        "FROM usageHistory WHERE provider IS NOT NULL "
        "GROUP BY provider ORDER BY reqs DESC LIMIT ?",
        (limit,),
    ).fetchall()
    c.close()
    return [dict(r) for r in rows]


def latency_stats():
    """p50/p95 dari sampel terakhir 500 request."""
    c = conn()
    rows = [r[0] for r in c.execute(
        "SELECT latencyMs FROM usageHistory ORDER BY id DESC LIMIT 500").fetchall()]
    c.close()
    if not rows:
        return {"p50": 0, "p95": 0, "avg": 0}
    s = sorted(rows)
    return {
        "p50": s[len(s) // 2],
        "p95": s[min(len(s) - 1, int(len(s) * 0.95))],
        "avg": round(sum(s) / len(s)),
    }


def last_hour_requests():
    c = conn()
    n = c.execute(
        "SELECT COUNT(*) n FROM usageHistory WHERE timestamp >= datetime('now','-1 hour')"
    ).fetchone()["n"]
    c.close()
    return n
