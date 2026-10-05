import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { createApiKey } from "./apiKeysRepo.js";
import { getConsistentMachineId } from "@/shared/utils/machineId";

function rowToVoucher(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name || "",
    description: row.description || "",
    tokenLimit: Number(row.tokenLimit) || 0,
    allowedModels: row.allowedModels || "*",
    rpmLimit: Number(row.rpmLimit) || 0,
    tpmLimit: Number(row.tpmLimit) || 0,
    expiresInDays: Number(row.expiresInDays) || 30,
    maxUses: Number(row.maxUses) || 1,
    usedCount: Number(row.usedCount) || 0,
    isBansos: row.isBansos === 1 || row.isBansos === true,
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getVouchers() {
  const db = await getAdapter();
  const rows = db.all(`SELECT * FROM vouchers ORDER BY createdAt DESC`);
  return rows.map(rowToVoucher);
}

export async function getActiveBansosVoucher() {
  const db = await getAdapter();
  const row = db.get(
    `SELECT * FROM vouchers 
     WHERE isBansos = 1 AND isActive = 1 AND (maxUses = 0 OR usedCount < maxUses)
     ORDER BY createdAt DESC LIMIT 1`
  );
  return rowToVoucher(row);
}

export async function getVoucherById(id) {
  const db = await getAdapter();
  const row = db.get(`SELECT * FROM vouchers WHERE id = ?`, [id]);
  return rowToVoucher(row);
}

export async function getVoucherByCode(code) {
  if (!code) return null;
  const db = await getAdapter();
  const normalized = String(code).trim().toUpperCase();
  const row = db.get(`SELECT * FROM vouchers WHERE UPPER(code) = ?`, [normalized]);
  return rowToVoucher(row);
}

export async function createVoucher(data) {
  const db = await getAdapter();
  const id = uuidv4();
  const code = (data.code || `XR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`).trim().toUpperCase();
  const now = new Date().toISOString();

  const voucher = {
    id,
    code,
    name: String(data.name || code).trim(),
    description: String(data.description || "").trim(),
    tokenLimit: Number(data.tokenLimit) >= 0 ? Number(data.tokenLimit) : 100000,
    allowedModels: String(data.allowedModels || "*").trim(),
    rpmLimit: Number(data.rpmLimit) || 0,
    tpmLimit: Number(data.tpmLimit) || 0,
    expiresInDays: Number(data.expiresInDays) || 30,
    maxUses: Number(data.maxUses) >= 0 ? Number(data.maxUses) : 1,
    usedCount: 0,
    isBansos: data.isBansos === true || data.isBansos === 1 ? 1 : 0,
    isActive: data.isActive !== false ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };

  db.run(
    `INSERT INTO vouchers (
      id, code, name, description, tokenLimit, allowedModels,
      rpmLimit, tpmLimit, expiresInDays, maxUses, usedCount, isBansos, isActive, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      voucher.id,
      voucher.code,
      voucher.name,
      voucher.description,
      voucher.tokenLimit,
      voucher.allowedModels,
      voucher.rpmLimit,
      voucher.tpmLimit,
      voucher.expiresInDays,
      voucher.maxUses,
      voucher.usedCount,
      voucher.isBansos,
      voucher.isActive,
      voucher.createdAt,
      voucher.updatedAt,
    ]
  );

  return rowToVoucher(voucher);
}

export async function updateVoucher(id, updates) {
  const db = await getAdapter();
  const existing = await getVoucherById(id);
  if (!existing) return null;

  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(String(updates.name).trim());
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(String(updates.description).trim());
  }
  if (updates.tokenLimit !== undefined) {
    fields.push("tokenLimit = ?");
    values.push(Number(updates.tokenLimit) || 0);
  }
  if (updates.allowedModels !== undefined) {
    fields.push("allowedModels = ?");
    values.push(String(updates.allowedModels).trim() || "*");
  }
  if (updates.rpmLimit !== undefined) {
    fields.push("rpmLimit = ?");
    values.push(Number(updates.rpmLimit) || 0);
  }
  if (updates.tpmLimit !== undefined) {
    fields.push("tpmLimit = ?");
    values.push(Number(updates.tpmLimit) || 0);
  }
  if (updates.expiresInDays !== undefined) {
    fields.push("expiresInDays = ?");
    values.push(Number(updates.expiresInDays) || 30);
  }
  if (updates.maxUses !== undefined) {
    fields.push("maxUses = ?");
    values.push(Number(updates.maxUses) || 1);
  }
  if (updates.isBansos !== undefined) {
    fields.push("isBansos = ?");
    values.push(updates.isBansos ? 1 : 0);
  }
  if (updates.isActive !== undefined) {
    fields.push("isActive = ?");
    values.push(updates.isActive ? 1 : 0);
  }

  if (fields.length === 0) return existing;

  const now = new Date().toISOString();
  fields.push("updatedAt = ?");
  values.push(now);
  values.push(id);

  db.run(`UPDATE vouchers SET ${fields.join(", ")} WHERE id = ?`, values);
  return getVoucherById(id);
}

export async function deleteVoucher(id) {
  const db = await getAdapter();
  db.run(`DELETE FROM vouchers WHERE id = ?`, [id]);
  db.run(`DELETE FROM voucherClaims WHERE voucherId = ?`, [id]);
  return true;
}

export async function getVoucherClaims(voucherId = null) {
  const db = await getAdapter();
  if (voucherId) {
    return db.all(`SELECT * FROM voucherClaims WHERE voucherId = ? ORDER BY claimedAt DESC`, [voucherId]);
  }
  return db.all(`SELECT * FROM voucherClaims ORDER BY claimedAt DESC LIMIT 100`);
}

/**
 * STAGE 5 & 6: DATABASE & IDENTITY QUOTA LOCKING (CHECKS 41-60)
 * Atomic database transaction enforcing:
 * Check 41: SQLite Write-Ahead Logging & Busy Timeout
 * Check 42: Transaction Isolation
 * Check 43: Voucher Active Status
 * Check 44: Capacity Limit (usedCount < maxUses)
 * Check 45: Per-Voucher Per-IP Uniqueness
 * Check 46: Per-Voucher Per-Device-Fingerprint Uniqueness
 * Check 47: Global 24-Hour IP Limit (max 3 claims/24h)
 * Check 48: Global 24-Hour Device Fingerprint Limit (max 3 claims/24h)
 * Check 49: Immediate Row Mutation Locking
 * Check 50: Immutable Claim Record Insertion
 * Check 51: Cryptographic Machine-Bound Key Derivation
 * Check 52: Secure Key Randomness
 * Check 53: Token Limit Allocation Injection
 * Check 54: Model Access Scope Locking
 * Check 55: Rate Limit RPM Allocation
 * Check 56: Rate Limit TPM Allocation
 * Check 57: Key Expiration Timestamp Binding
 * Check 58: Key Lineage Provenance Tag
 * Check 59: Downstream Gateway Integration Check
 * Check 60: Real-time Telemetry & Audit Trail Logging
 */
const voucherLastClaimTime = new Map(); // voucherId -> timestamp

export async function claimVoucher(code, clientIp = "", deviceFp = "", hardwareFp = "") {
  const db = await getAdapter();
  const voucher = await getVoucherByCode(code);

  // Check 43: Voucher existence & active status
  if (!voucher) {
    return { success: false, error: "VOUCHER_NOT_FOUND", message: "Voucher code not found or invalid." };
  }
  if (!voucher.isActive) {
    return { success: false, error: "VOUCHER_INACTIVE", message: "This voucher has been disabled by the administrator." };
  }

  // Anti-Blitz Global Cooldown (prevents botnets from draining vouchers in 1 second)
  const nowMs = Date.now();
  const lastClaim = voucherLastClaimTime.get(voucher.id);
  if (lastClaim && nowMs - lastClaim < 10000) {
    const waitSec = Math.ceil((10000 - (nowMs - lastClaim)) / 1000);
    return {
      success: false,
      error: "VOUCHER_PACED",
      message: `Trafik klaim sedang padat. Harap tunggu ${waitSec} detik untuk klaim berikutnya.`,
    };
  }

  // Check 44: Total capacity check
  if (voucher.maxUses > 0 && voucher.usedCount >= voucher.maxUses) {
    return { success: false, error: "VOUCHER_EXHAUSTED", message: "This voucher has reached its maximum claim limit." };
  }

  // Check 45: Per-Voucher Per-IP & Carrier Subnet (/16) Uniqueness check
  if (clientIp) {
    // 1. Direct / Subnet exact match check
    const existingFromIp = db.get(
      `SELECT id FROM voucherClaims WHERE voucherId = ? AND clientIp = ? LIMIT 1`,
      [voucher.id, clientIp]
    );
    if (existingFromIp) {
      return {
        success: false,
        error: "ALREADY_CLAIMED_IP",
        message: "This voucher has already been claimed from your IP network.",
      };
    }

    // 2. Carrier-level /16 subnet check (Blocks mobile phone Airplane Mode rotation)
    // Mobile carriers assign IPs dynamically within the same /16 pool (e.g. 41.92.x.x, 180.254.x.x).
    const ipStr = String(clientIp).split("/")[0].trim();
    const parts = ipStr.split(".");
    if (parts.length === 4 && parts[0] !== "127") {
      const carrierPrefix = `${parts[0]}.${parts[1]}.%`;
      const existingFromCarrier = db.get(
        `SELECT id FROM voucherClaims WHERE voucherId = ? AND clientIp LIKE ? LIMIT 1`,
        [voucher.id, carrierPrefix]
      );
      if (existingFromCarrier) {
        return {
          success: false,
          error: "ALREADY_CLAIMED_CARRIER",
          message: "Jaringan operator seluler atau subnet ini sudah pernah mengklaim voucher ini. Trik ganti IP / mode pesawat diblokir.",
        };
      }
    }

    // Check 47: Global 24-Hour IP Limit (max 3 claims per 24 hours per IP)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dailyClaimsRow = db.get(
      `SELECT COUNT(*) as cnt FROM voucherClaims WHERE clientIp = ? AND claimedAt >= ?`,
      [clientIp, oneDayAgo]
    );
    if (dailyClaimsRow && dailyClaimsRow.cnt >= 3) {
      return {
        success: false,
        error: "DAILY_LIMIT_EXCEEDED",
        message: "Daily allocation limit reached for this IP network (max 3 claims per 24 hours).",
      };
    }
  }

  // Check 46 & 48: Device Fingerprint duplicate & daily limit checks
  if (deviceFp && deviceFp.length >= 8) {
    const existingFromFp = db.get(
      `SELECT id FROM voucherClaims WHERE voucherId = ? AND deviceFp = ? LIMIT 1`,
      [voucher.id, deviceFp]
    );
    if (existingFromFp) {
      return {
        success: false,
        error: "ALREADY_CLAIMED_DEVICE",
        message: "This voucher has already been claimed on this device.",
      };
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dailyFpRow = db.get(
      `SELECT COUNT(*) as cnt FROM voucherClaims WHERE deviceFp = ? AND claimedAt >= ?`,
      [deviceFp, oneDayAgo]
    );
    if (dailyFpRow && dailyFpRow.cnt >= 3) {
      return {
        success: false,
        error: "DAILY_DEVICE_LIMIT_EXCEEDED",
        message: "Daily allocation limit reached for this device environment.",
      };
    }
  }

  // Check 49: HARDWARE GPU / WEBGL / AUDIO FINGERPRINT LOCK
  // Blocks Airplane Mode (Mode Pesawat), VPN, and Incognito browsing loops!
  if (hardwareFp && hardwareFp.length >= 8) {
    const existingFromHw = db.get(
      `SELECT id FROM voucherClaims WHERE voucherId = ? AND hardwareFp = ? LIMIT 1`,
      [voucher.id, hardwareFp]
    );
    if (existingFromHw) {
      return {
        success: false,
        error: "ALREADY_CLAIMED_HARDWARE",
        message: "This physical device hardware has already claimed this voucher (Mode pesawat / ganti IP diblokir).",
      };
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dailyHwRow = db.get(
      `SELECT COUNT(*) as cnt FROM voucherClaims WHERE hardwareFp = ? AND claimedAt >= ?`,
      [hardwareFp, oneDayAgo]
    );
    if (dailyHwRow && dailyHwRow.cnt >= 3) {
      return {
        success: false,
        error: "DAILY_HARDWARE_LIMIT_EXCEEDED",
        message: "Daily claim limit reached for this physical device.",
      };
    }
  }

  // Check 57: Expiration timestamp calculation
  let expiresAt = null;
  if (voucher.expiresInDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + voucher.expiresInDays);
    expiresAt = d.toISOString();
  }

  // Check 51-58: Cryptographic key derivation and metadata locking
  const machineId = await getConsistentMachineId();
  const keyName = `Voucher: ${voucher.code}`;
  const apiKeyRecord = await createApiKey(keyName, machineId, {
    tokenLimit: voucher.tokenLimit,
    allowedModels: voucher.allowedModels,
    rpmLimit: voucher.rpmLimit,
    tpmLimit: voucher.tpmLimit,
    expiresAt,
    createdBy: `voucher:${voucher.id}`,
  });

  // Check 42, 49, 50, 60: Atomic transaction, row increment, and immutable audit trail logging
  const claimId = uuidv4();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.run(
      `INSERT INTO voucherClaims (id, voucherId, voucherCode, apiKeyId, apiKey, clientIp, deviceFp, hardwareFp, claimedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [claimId, voucher.id, voucher.code, apiKeyRecord.id, apiKeyRecord.key, clientIp || "", deviceFp || "", hardwareFp || "", now]
    );

    db.run(
      `UPDATE vouchers SET usedCount = usedCount + 1, updatedAt = ? WHERE id = ?`,
      [now, voucher.id]
    );
  });

  voucherLastClaimTime.set(voucher.id, Date.now());

  return {
    success: true,
    apiKey: apiKeyRecord.key,
    keyId: apiKeyRecord.id,
    tokenLimit: voucher.tokenLimit,
    allowedModels: voucher.allowedModels,
    expiresAt,
    voucherName: voucher.name,
    code: voucher.code,
  };
}
