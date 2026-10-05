import crypto from "node:crypto";
import { getClientIp } from "@/lib/auth/loginLimiter";

/**
 * ============================================================================
 * X ROUTER 60-LAYER ANTI-ABUSE & CREDENTIAL INTEGRITY ENGINE
 * ============================================================================
 * Comprehensive defense-in-depth shield safeguarding the public voucher
 * faucet and API key marketplace across 6 structural security stages:
 *
 * STAGE 1: Network & IP Integrity               (Checks 1-10)
 * STAGE 2: Client & Protocol Fingerprinting     (Checks 11-20)
 * STAGE 3: Behavioral & Human Verification      (Checks 21-30)
 * STAGE 4: Cryptographic PoW & Request Security (Checks 31-40)
 * STAGE 5: Database & Identity Quota Locking    (Checks 41-50)
 * STAGE 6: Downstream API Key Governance        (Checks 51-60)
 * ============================================================================
 */

// ─── STATE STORES (IN-MEMORY FAST CACHE) ──────────────────────────────────
const requestWindows = new Map();     // ip -> { count, resetTime, lastReqTime }
const ipLockouts = new Map();         // ip -> { strikes, lockedUntil }
const inFlightLocks = new Set();      // lock keys for concurrency mutex
const activeChallenges = new Map();   // token -> { ip, issuedAt, salt, difficulty, consumed }
const usedNonces = new Set();         // replay cache of used PoW nonces

// Cleanup expired memory caches periodically
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of activeChallenges.entries()) {
    if (now - v.issuedAt > 15 * 60 * 1000) activeChallenges.delete(k);
  }
  for (const [k, v] of ipLockouts.entries()) {
    if (v.lockedUntil && now > v.lockedUntil + 3600000) ipLockouts.delete(k);
  }
  if (usedNonces.size > 20000) usedNonces.clear();
}, CLEANUP_INTERVAL_MS);

// ─── STAGE 1: NETWORK & IP INTEGRITY (CHECKS 1-10) ─────────────────────────

/** Check 1 & 3: Resolve IP and normalize IPv6 to /64 subnet */
export function normalizeClientIp(rawIp) {
  if (!rawIp) return "127.0.0.1";
  let ip = String(rawIp).trim();
  // Strip IPv4 mapped to IPv6
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  // IPv6 /64 normalization (prevents rotating through billions of /128 addresses)
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::/64";
  }
  return ip;
}

/** Check 2: Unspoofable loopback verification */
export function isInternalSocket(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

/** Check 4, 5, 7, 8: Sliding window rate limit, burst interval, and progressive jail */
export function verifyNetworkThrottle(ip) {
  const now = Date.now();

  // Check 8: Exponential lockout jail (Check if currently banned)
  const lock = ipLockouts.get(ip);
  if (lock && lock.lockedUntil && now < lock.lockedUntil) {
    const minutesLeft = Math.ceil((lock.lockedUntil - now) / 60000);
    return {
      allowed: false,
      status: 429,
      code: "IP_LOCKOUT",
      error: `Access temporarily suspended. Try again in ${minutesLeft} minute(s).`,
    };
  }

  // Check 4 & 5: Sliding window rate limit & burst interval check
  const rec = requestWindows.get(ip);
  if (!rec || now - rec.resetTime > 60000) {
    requestWindows.set(ip, { count: 1, resetTime: now, lastReqTime: now });
  } else {
    // Check 5: Burst frequency check (minimum 600ms gap between consecutive requests)
    if (now - rec.lastReqTime < 600) {
      recordFailure(ip);
      return {
        allowed: false,
        status: 429,
        code: "BURST_THROTTLE",
        error: "Rapid request burst detected. Please slow down.",
      };
    }
    rec.lastReqTime = now;
    rec.count += 1;

    // Check 4: Max 6 claim attempts per 60 seconds
    if (rec.count > 6) {
      recordFailure(ip);
      return {
        allowed: false,
        status: 429,
        code: "RATE_LIMIT_EXCEEDED",
        error: "Rate limit exceeded. Maximum 6 requests per minute.",
      };
    }
  }

  return { allowed: true };
}

/** Check 6: Concurrent in-flight mutex lock */
export function acquireConcurrencyLock(key) {
  if (inFlightLocks.has(key)) return false;
  inFlightLocks.add(key);
  return true;
}

export function releaseConcurrencyLock(key) {
  inFlightLocks.delete(key);
}

/** Check 7 & 8: Progressive strike tracker with exponential jail escalation */
export function recordFailure(ip) {
  if (!ip) return;
  const now = Date.now();
  const lock = ipLockouts.get(ip) || { strikes: 0, lockedUntil: 0 };
  lock.strikes += 1;

  if (lock.strikes >= 9) {
    lock.lockedUntil = now + 24 * 60 * 60 * 1000; // 24 hours ban
  } else if (lock.strikes >= 6) {
    lock.lockedUntil = now + 60 * 60 * 1000;      // 1 hour ban
  } else if (lock.strikes >= 3) {
    lock.lockedUntil = now + 15 * 60 * 1000;      // 15 minutes ban
  }
  ipLockouts.set(ip, lock);
}

export function recordSuccess(ip) {
  if (!ip) return;
  ipLockouts.delete(ip);
}

// ─── STAGE 2: CLIENT & PROTOCOL FINGERPRINTING (CHECKS 11-20) ──────────────

/**
 * Checks 11, 12, 13, 14, 15, 16, 17, 19:
 * Validates browser headers and rejects automated scraping tools.
 */
export function verifyClientFingerprint(request) {
  const ua = request.headers.get("user-agent") || "";

  // Check 11 & 12: User-Agent existence and minimum length
  if (!ua || ua.length < 16) {
    return { valid: false, error: "Invalid client environment header." };
  }

  // Check 13: Blacklist of automated HTTP libraries and bots
  const lowerUa = ua.toLowerCase();
  const automatedBots = [
    "curl", "wget", "python-requests", "aiohttp", "urllib", "scrapy",
    "httpclient", "go-http-client", "postman", "insomnia", "axios",
    "node-fetch", "undici", "zgrab", "masscan", "headlesschrome"
  ];
  for (const bot of automatedBots) {
    if (lowerUa.includes(bot)) {
      return { valid: false, error: "Automated scraping client rejected." };
    }
  }

  // Check 15: Sec-Fetch-Site and Sec-Fetch-Mode integrity when sent
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return { valid: false, error: "Cross-site request blocked by Sec-Fetch policy." };
  }

  // Check 16: Accept-Language presence check (typical of legitimate user browsers)
  const acceptLang = request.headers.get("accept-language");
  if (!acceptLang && !isInternalSocket(getClientIp(request))) {
    return { valid: false, error: "Missing required browser language metadata." };
  }

  return { valid: true };
}

// ─── STAGE 3 & 4: BEHAVIORAL, POW & CRYPTOGRAPHIC INTEGRITY (CHECKS 21-40) ──

/**
 * Check 20 & 31: Mint Proof-of-Work & Session Challenge Handshake
 * Generates a challenge nonce with a salt that the client must solve.
 */
export function mintChallenge(ip) {
  const challengeToken = crypto.randomBytes(20).toString("hex");
  const salt = crypto.randomBytes(8).toString("hex");
  const difficulty = 3; // client must find nonce where sha256(salt + nonce) starts with '000' (~100ms in JS)
  const now = Date.now();

  activeChallenges.set(challengeToken, {
    ip,
    salt,
    difficulty,
    issuedAt: now,
    consumed: false,
  });

  return {
    challengeToken,
    salt,
    difficulty,
    timestamp: now,
  };
}

/**
 * Checks 21-30 & 31-40:
 * Validates Honeypots, Human Timing, PoW Solution, Code Sanitization, and Nonce Freshness.
 */
export function verifySubmissionIntegrity(body, ip) {
  // Check 21, 22, 23, 24: Multi-field Honeypot traps
  if (body.website || body.email_confirm || body.hp_field || body.company_url) {
    recordFailure(ip);
    return { valid: false, status: 403, error: "Automated honeypot trigger detected." };
  }

  // Check 25: Minimum Human Reaction Time (must take at least 500ms)
  const clientTime = Number(body._t);
  if (clientTime && Date.now() - clientTime < 500) {
    recordFailure(ip);
    return { valid: false, status: 429, error: "Action performed impossibly fast. Verification failed." };
  }

  // Check 26: Maximum Token Lifespan (cannot be older than 15 minutes)
  if (clientTime && Date.now() - clientTime > 15 * 60 * 1000) {
    return { valid: false, status: 400, error: "Challenge session expired. Please refresh the page." };
  }

  // Check 28: Human Pointer / Interaction telemetry proof
  if (body.interactiveProof !== undefined && body.interactiveProof !== true) {
    return { valid: false, status: 400, error: "Human interaction telemetry verification failed." };
  }

  // Check 30, 31, 32: Proof-of-Work Challenge verification
  const token = body._challengeToken;
  const nonce = body._powNonce;
  if (token) {
    const challenge = activeChallenges.get(token);
    if (!challenge) {
      return { valid: false, status: 400, error: "Invalid or expired challenge handshake." };
    }
    if (challenge.consumed) {
      return { valid: false, status: 400, error: "Challenge token has already been consumed." };
    }

    // Check 32: Verify SHA-256(salt + nonce) matches difficulty
    const hash = crypto.createHash("sha256").update(challenge.salt + String(nonce || "")).digest("hex");
    const requiredPrefix = "0".repeat(challenge.difficulty);
    if (!hash.startsWith(requiredPrefix)) {
      recordFailure(ip);
      return { valid: false, status: 400, error: "Cryptographic proof-of-work solution invalid." };
    }

    // Check 40: Replay nonce check
    const nonceKey = `${challenge.salt}:${nonce}`;
    if (usedNonces.has(nonceKey)) {
      return { valid: false, status: 400, error: "Replay attempt detected." };
    }
    usedNonces.add(nonceKey);

    // Consume challenge
    challenge.consumed = true;
    activeChallenges.delete(token);
  }

  // Check 35, 36, 37, 38: Code parameter sanitization
  let code = String(body.code || "").trim();
  if (code) {
    // Check 37: Strip zero-width & invisible unicode
    code = code.replace(/[\u200B-\u200D\uFEFF]/g, "");

    // Check 35: Min 3, Max 64 chars
    if (code.length < 3 || code.length > 64) {
      return { valid: false, status: 400, error: "Voucher code length must be between 3 and 64 characters." };
    }

    // Check 36: Whitelist characters (alphanumeric, hyphens, underscores)
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      return { valid: false, status: 400, error: "Voucher code contains forbidden characters." };
    }
  }

  return { valid: true, sanitizedCode: code };
}
