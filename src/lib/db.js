// X Router — SQLite layer (node:sqlite).
// Skema 1:1 dengan db.py (fork struktur 9router): providerConnections /
// apiKeys / usageHistory / requestDetails / kv + users/sessions buat login.

import { DatabaseSync } from "node:sqlite";
import { randomBytes, pbkdf2Sync, timingSafeEqual, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE_DIR = process.cwd();
// Railway/volume bisa mount data di lokasi lain lewat XR_DATA_DIR
const DATA_DIR = process.env.XR_DATA_DIR
  ? path.resolve(process.env.XR_DATA_DIR)
  : path.join(BASE_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "xrouter.db");
const REGISTRY_PATH = path.join(BASE_DIR, "registry", "providers.json");

export const SESSION_TTL = 60 * 60 * 12;

let _db = null;

export function db() {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA busy_timeout = 5000");
  _db.exec("PRAGMA foreign_keys = ON");
  _db.exec(SCHEMA);
  ensureAdmin();
  return _db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

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

CREATE TABLE IF NOT EXISTS providerConnections (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  authType TEXT NOT NULL DEFAULT 'apikey',
  name TEXT,
  priority INTEGER DEFAULT 100,
  isActive INTEGER DEFAULT 1,
  data TEXT NOT NULL DEFAULT '{}',
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
`;

// ------------------------------------------------------------- auth

export function hashPw(pw, salt) {
  return pbkdf2Sync(String(pw), String(salt), 200000, 32, "sha256").toString("hex");
}

function ensureAdmin() {
  const d = db();
  const row = d.prepare("SELECT 1 FROM users LIMIT 1").get();
  if (row) return;
  const pw = process.env.XR_ADMIN_PW || randomBytes(9).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  d.prepare(
    "INSERT INTO users (username, pass_hash, salt, created_at) VALUES (?,?,?,?)"
  ).run("admin", hashPw(pw, salt), salt, Math.floor(Date.now() / 1000));
}

export function verifyPw(username, pw) {
  const row = db()
    .prepare("SELECT pass_hash, salt FROM users WHERE username=?")
    .get(username);
  if (!row) return false;
  const a = Buffer.from(hashPw(pw, row.salt), "hex");
  const b = Buffer.from(row.pass_hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSession(userId) {
  const tok = randomBytes(32).toString("base64url");
  db().prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)"
  ).run(tok, userId, Math.floor(Date.now() / 1000) + SESSION_TTL);
  return tok;
}

export function sessionUser(token) {
  if (!token) return null;
  const row = db()
    .prepare(
      "SELECT u.username FROM sessions s JOIN users u ON u.id=s.user_id " +
        "WHERE s.token=? AND s.expires_at>?"
    )
    .get(token, Math.floor(Date.now() / 1000));
  return row ? row.username : null;
}

export function dropSession(token) {
  if (token) db().prepare("DELETE FROM sessions WHERE token=?").run(token);
}

export function adminId() {
  const row = db().prepare("SELECT id FROM users WHERE username='admin'").get();
  return row ? row.id : null;
}

export function setPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  db()
    .prepare("UPDATE users SET pass_hash=?, salt=? WHERE username='admin'")
    .run(hashPw(pw, salt), salt);
  // sesi lama dibuang — paksa login ulang
  db().prepare("DELETE FROM sessions").run();
}

// ------------------------------------------------------------- api keys

const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

export function newApiKey(name = "default") {
  const key = "xr-" + randomBytes(20).toString("hex");
  db()
    .prepare(
      "INSERT INTO apiKeys (id, key, name, createdAt) VALUES (?,?,?,?)"
    )
    .run(randomBytes(8).toString("hex"), key, name, now());
  return key;
}

export function listApiKeys() {
  return db()
    .prepare(
      "SELECT key,name,isActive,createdAt,lastUsedAt,usedTokens,tokenLimit FROM apiKeys ORDER BY createdAt DESC"
    )
    .all();
}

export function checkApiKey(key) {
  if (!key) return false;
  const d = db();
  const row = d
    .prepare("SELECT isActive, tokenLimit, usedTokens FROM apiKeys WHERE key=?")
    .get(key);
  if (row && row.isActive && (row.tokenLimit === 0 || row.usedTokens < row.tokenLimit)) {
    d.prepare("UPDATE apiKeys SET lastUsedAt=? WHERE key=?").run(now(), key);
    return true;
  }
  return false;
}

export function addTokens(key, n) {
  if (!n || n <= 0) return;
  db().prepare("UPDATE apiKeys SET usedTokens=usedTokens+? WHERE key=?").run(n, key);
}

export function revokeApiKey(key) {
  db().prepare("UPDATE apiKeys SET isActive=0 WHERE key=?").run(key);
}

export function firstKey() {
  const row = db()
    .prepare("SELECT key FROM apiKeys WHERE isActive=1 ORDER BY createdAt ASC LIMIT 1")
    .get();
  return row ? row.key : null;
}

// ------------------------------------------------------------- connections

export function listConnections(provider, activeOnly = true) {
  let sql = "SELECT * FROM providerConnections";
  const args = [];
  if (provider) {
    sql += " WHERE provider=?";
    args.push(provider);
    if (activeOnly) sql += " AND isActive=1";
  } else if (activeOnly) {
    sql += " WHERE isActive=1";
  }
  sql += " ORDER BY priority ASC, createdAt ASC";
  return db()
    .prepare(sql)
    .all(...args)
    .map((r) => ({ ...r, data: JSON.parse(r.data || "{}") }));
}

export function upsertConnection(cid, provider, data, name = null, priority = 100) {
  const ts = now();
  const existing = db()
    .prepare("SELECT id FROM providerConnections WHERE id=?")
    .get(cid);
  if (existing) {
    db()
      .prepare(
        "UPDATE providerConnections SET data=?, updatedAt=?, isActive=1 WHERE id=?"
      )
      .run(JSON.stringify(data), ts, cid);
  } else {
    db()
      .prepare(
        "INSERT INTO providerConnections (id,provider,name,priority,data,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)"
      )
      .run(cid, provider, name, priority, JSON.stringify(data), ts, ts);
  }
}

export function deleteConnection(cid) {
  db().prepare("DELETE FROM providerConnections WHERE id=?").run(cid);
}

// ------------------------------------------------------------- registry

let _reg = null;
export function loadRegistry() {
  if (_reg) return _reg;
  try {
    _reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  } catch {
    _reg = [];
  }
  return _reg;
}

// ------------------------------------------------------------- usage

export function logUsage({ provider, model, endpoint, status, latencyMs = 0,
  promptTokens = 0, completionTokens = 0, connectionId = null }) {
  db()
    .prepare(
      "INSERT INTO usageHistory (timestamp,provider,model,connectionId,endpoint," +
        "promptTokens,completionTokens,status,latencyMs) VALUES (?,?,?,?,?,?,?,?,?)"
    )
    .run(now(), provider, model, connectionId, endpoint, promptTokens,
      completionTokens, status, latencyMs);
}

export function stats() {
  const d = db();
  const keys = d.prepare("SELECT COUNT(*) n FROM apiKeys").get().n;
  const conns = d
    .prepare("SELECT COUNT(*) n FROM providerConnections WHERE isActive=1")
    .get().n;
  const reqs = d.prepare("SELECT COUNT(*) n FROM usageHistory").get().n;
  const ok = d
    .prepare("SELECT COUNT(*) n FROM usageHistory WHERE status='ok'")
    .get().n;
  const tokens = d
    .prepare(
      "SELECT COALESCE(SUM(promptTokens+completionTokens),0) n FROM usageHistory"
    )
    .get().n;
  const recent = d
    .prepare(
      "SELECT timestamp,provider,model,endpoint,status,latencyMs,promptTokens," +
        "completionTokens FROM usageHistory ORDER BY id DESC LIMIT 40"
    )
    .all();
  return { keys, connections: conns, requests: reqs, ok, tokens, recent };
}

export function usageDaily(days = 14) {
  return db()
    .prepare(
      "SELECT substr(timestamp,1,10) AS day, COUNT(*) AS reqs," +
        " COALESCE(SUM(promptTokens),0) AS pt, COALESCE(SUM(completionTokens),0) AS ct " +
        "FROM usageHistory WHERE timestamp >= datetime('now', ?) " +
        "GROUP BY day ORDER BY day ASC"
    )
    .all(`-${days} days`);
}

export function topModels(limit = 10) {
  return db()
    .prepare(
      "SELECT model, provider, COUNT(*) AS reqs," +
        " COALESCE(SUM(promptTokens+completionTokens),0) AS tokens, " +
        "COALESCE(ROUND(AVG(latencyMs)),0) AS avg_ms " +
        "FROM usageHistory WHERE model IS NOT NULL " +
        "GROUP BY model, provider ORDER BY reqs DESC LIMIT ?"
    )
    .all(limit);
}

export function providerBreakdown(limit = 12) {
  return db()
    .prepare(
      "SELECT provider, COUNT(*) AS reqs," +
        " COALESCE(SUM(promptTokens+completionTokens),0) AS tokens, " +
        "COALESCE(SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END),0) AS ok " +
        "FROM usageHistory WHERE provider IS NOT NULL " +
        "GROUP BY provider ORDER BY reqs DESC LIMIT ?"
    )
    .all(limit);
}

export function latencyStats() {
  const rows = db()
    .prepare("SELECT latencyMs FROM usageHistory ORDER BY id DESC LIMIT 500")
    .all()
    .map((r) => r.latencyMs || 0);
  if (!rows.length) return { p50: 0, p95: 0, avg: 0 };
  const s = [...rows].sort((a, b) => a - b);
  return {
    p50: s[Math.floor(s.length / 2)],
    p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
    avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length),
  };
}

export function lastHourRequests() {
  return db()
    .prepare(
      "SELECT COUNT(*) n FROM usageHistory WHERE timestamp >= datetime('now','-1 hour')"
    )
    .get().n;
}

export function clearLogs() {
  const n = db().prepare("SELECT COUNT(*) n FROM usageHistory").get().n;
  db().prepare("DELETE FROM usageHistory").run();
  db().prepare("DELETE FROM requestDetails").run();
  return n;
}
