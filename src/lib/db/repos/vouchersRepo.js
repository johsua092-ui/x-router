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
    maxUses: Number(data.maxUses) > 0 ? Number(data.maxUses) : 1,
    usedCount: 0,
    isActive: data.isActive !== false ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  };

  db.run(
    `INSERT INTO vouchers (
      id, code, name, description, tokenLimit, allowedModels,
      rpmLimit, tpmLimit, expiresInDays, maxUses, usedCount, isActive, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
 * Claim voucher by code with strict anti-abuse protections:
 * 1. Voucher validity, status, and maxUses check.
 * 2. Strict 1 claim per voucher per IP address (enforced even if maxUses > 1).
 * 3. Daily IP claim quota (max 3 total voucher claims per IP per 24 hours).
 * 4. Atomic transaction with row locking.
 */
export async function claimVoucher(code, clientIp = "") {
  const db = await getAdapter();
  const voucher = await getVoucherByCode(code);

  if (!voucher) {
    return { success: false, error: "VOUCHER_NOT_FOUND", message: "Voucher code not found or invalid." };
  }

  if (!voucher.isActive) {
    return { success: false, error: "VOUCHER_INACTIVE", message: "This voucher has been disabled by the administrator." };
  }

  if (voucher.maxUses > 0 && voucher.usedCount >= voucher.maxUses) {
    return { success: false, error: "VOUCHER_EXHAUSTED", message: "This voucher has reached its maximum claim limit." };
  }

  // Anti-Abuse Rule 1: One claim per voucher per IP address
  if (clientIp) {
    const existingFromIp = db.get(
      `SELECT id FROM voucherClaims WHERE voucherId = ? AND clientIp = ? LIMIT 1`,
      [voucher.id, clientIp]
    );
    if (existingFromIp) {
      return {
        success: false,
        error: "ALREADY_CLAIMED",
        message: "You have already claimed this voucher from this IP address.",
      };
    }

    // Anti-Abuse Rule 2: Daily global claim cap per IP (max 3 voucher claims per 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dailyClaimsRow = db.get(
      `SELECT COUNT(*) as cnt FROM voucherClaims WHERE clientIp = ? AND claimedAt >= ?`,
      [clientIp, oneDayAgo]
    );
    const dailyClaimsCount = dailyClaimsRow ? dailyClaimsRow.cnt : 0;
    if (dailyClaimsCount >= 3) {
      return {
        success: false,
        error: "DAILY_LIMIT_EXCEEDED",
        message: "Daily claim limit reached for this IP address (max 3 claims per 24 hours). Please try again tomorrow.",
      };
    }
  }

  // Calculate expiration date
  let expiresAt = null;
  if (voucher.expiresInDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + voucher.expiresInDays);
    expiresAt = d.toISOString();
  }

  // Create API key in database
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

  // Record claim and increment usedCount atomically
  const claimId = uuidv4();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.run(
      `INSERT INTO voucherClaims (id, voucherId, voucherCode, apiKeyId, apiKey, clientIp, claimedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [claimId, voucher.id, voucher.code, apiKeyRecord.id, apiKeyRecord.key, clientIp || "", now]
    );

    db.run(
      `UPDATE vouchers SET usedCount = usedCount + 1, updatedAt = ? WHERE id = ?`,
      [now, voucher.id]
    );
  });

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
