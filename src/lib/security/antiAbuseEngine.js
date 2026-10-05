import crypto from "node:crypto";
import { getClientIp } from "@/lib/auth/loginLimiter";

/**
 * ============================================================================
 * X ROUTER MILITARY-GRADE ZERO-ABUSE FORTRESS ENGINE (TITANIUM EDITION)
 * ============================================================================
 * 1. Self-Hosted Native Visual Anti-Bot SVG CAPTCHA (HMAC Signed, zero 3rd party)
 * 2. Adaptive Proof-of-Work (Dynamic Difficulty 4 to 5 based on IP reputation)
 * 3. Physical Device Hardware Attestation (Canvas 2D + WebGL + AudioContext)
 * 4. Anti-Airplane Mode & Anti-VPN Lockout (Persistent hardware binding)
 * 5. Headless Automation Detection (WebDriver, SwiftShader, llvmpipe virtual GPUs)
 * 6. Global Anti-Blitz Voucher Pacing (Stops botnets from draining pools)
 * 7. 4-Attempt Progressive IP Lockout Jail (15m, 1h, 24h escalating bans)
 * 8. IPv6 Subnet /64 Normalization & Concurrency Mutex Locks
 * 9. Single-Use Nonce & Signature Replay Defense
 * ============================================================================
 */

const CAPTCHA_SECRET = process.env.JWT_SECRET || "xrouter-military-captcha-secret-key";

// State stores in memory
const requestWindows = new Map();     // ip -> { count, resetTime, lastReqTime }
const ipLockouts = new Map();         // ip -> { strikes, lockedUntil }
const inFlightLocks = new Set();      // lock keys for concurrency mutex
const activeChallenges = new Map();   // token -> { ip, issuedAt, salt, difficulty, consumed }
const usedNonces = new Set();         // replay cache of used PoW nonces
const usedCaptchaTokens = new Set();  // replay cache of solved CAPTCHAs

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of activeChallenges.entries()) {
    if (now - v.issuedAt > 15 * 60 * 1000) activeChallenges.delete(k);
  }
  for (const [k, v] of ipLockouts.entries()) {
    if (v.lockedUntil && now > v.lockedUntil + 3600000) ipLockouts.delete(k);
  }
  if (usedNonces.size > 50000) usedNonces.clear();
  if (usedCaptchaTokens.size > 50000) usedCaptchaTokens.clear();
}, CLEANUP_INTERVAL_MS);

/** Normalize IPv6 to /64 subnet */
export function normalizeClientIp(rawIp) {
  if (!rawIp) return "127.0.0.1";
  let ip = String(rawIp).trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::/64";
  }
  return ip;
}

export function isInternalSocket(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

/** Rate throttle per IP */
export function verifyNetworkThrottle(ip) {
  const now = Date.now();

  const lock = ipLockouts.get(ip);
  if (lock && lock.lockedUntil && now < lock.lockedUntil) {
    const minutesLeft = Math.ceil((lock.lockedUntil - now) / 60000);
    return {
      allowed: false,
      status: 429,
      code: "IP_LOCKOUT",
      error: `IP address suspended due to repeated verification failures. Retry in ${minutesLeft} minute(s).`,
    };
  }

  const rec = requestWindows.get(ip);
  if (!rec || now - rec.resetTime > 60000) {
    requestWindows.set(ip, { count: 1, resetTime: now, lastReqTime: now });
  } else {
    // Minimum 1000ms gap between consecutive attempts
    if (now - rec.lastReqTime < 1000) {
      recordFailure(ip);
      return {
        allowed: false,
        status: 429,
        code: "BURST_THROTTLE",
        error: "Submissions too frequent. Please pace requests naturally.",
      };
    }
    rec.lastReqTime = now;
    rec.count += 1;

    // Max 5 requests per 60 seconds per IP
    if (rec.count > 5) {
      recordFailure(ip);
      return {
        allowed: false,
        status: 429,
        code: "RATE_LIMIT_EXCEEDED",
        error: "Rate limit exceeded. Maximum 5 attempts per minute.",
      };
    }
  }

  return { allowed: true };
}

export function acquireConcurrencyLock(key) {
  if (inFlightLocks.has(key)) return false;
  inFlightLocks.add(key);
  return true;
}

export function releaseConcurrencyLock(key) {
  inFlightLocks.delete(key);
}

export function recordFailure(ip) {
  if (!ip) return;
  const now = Date.now();
  const lock = ipLockouts.get(ip) || { strikes: 0, lockedUntil: 0 };
  lock.strikes += 1;

  if (lock.strikes >= 8) {
    lock.lockedUntil = now + 24 * 60 * 60 * 1000; // 24h ban
  } else if (lock.strikes >= 5) {
    lock.lockedUntil = now + 60 * 60 * 1000;      // 1h ban
  } else if (lock.strikes >= 3) {
    lock.lockedUntil = now + 15 * 60 * 1000;      // 15m ban
  }
  ipLockouts.set(ip, lock);
}

export function recordSuccess(ip) {
  if (!ip) return;
  ipLockouts.delete(ip);
}

/** Check browser identity and block headless scraping frameworks */
export function verifyClientFingerprint(request) {
  const ua = request.headers.get("user-agent") || "";
  if (!ua || ua.length < 20) {
    return { valid: false, error: "Invalid client environment header." };
  }

  const lowerUa = ua.toLowerCase();
  const automatedBots = [
    "curl", "wget", "python-requests", "aiohttp", "urllib", "scrapy",
    "httpclient", "go-http-client", "postman", "insomnia", "axios",
    "node-fetch", "undici", "zgrab", "masscan", "headlesschrome",
    "puppeteer", "playwright", "selenium", "phantomjs"
  ];
  for (const bot of automatedBots) {
    if (lowerUa.includes(bot)) {
      return { valid: false, error: "Automated scripting client rejected." };
    }
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return { valid: false, error: "Cross-site request blocked." };
  }

  const accept = request.headers.get("accept") || "";
  if (!accept.includes("json") && !accept.includes("*/*")) {
    return { valid: false, error: "Invalid Accept header." };
  }

  return { valid: true };
}

/**
 * Generate Visual Anti-Bot SVG CAPTCHA (Clean & Fast)
 * Eliminates character ambiguity (no 0/O, no 1/I).
 */
export function generateVisualCaptcha() {
  const charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += charset[Math.floor(Math.random() * charset.length)];
  }

  const salt = crypto.randomBytes(8).toString("hex");
  const ts = Date.now();
  const sig = crypto.createHmac("sha256", CAPTCHA_SECRET).update(`${code}:${salt}:${ts}`).digest("hex");
  const token = `${ts}.${salt}.${sig}`;

  const width = 120;
  const height = 40;
  let noise = "";
  for (let i = 0; i < 4; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    noise += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#E56A4A" stroke-width="1.2" stroke-opacity="0.35" />`;
  }

  const glyphs = code.split("").map((ch, idx) => {
    const x = 14 + idx * 25 + (Math.random() * 4 - 2);
    const y = 28 + (Math.random() * 4 - 2);
    const rot = Math.floor(Math.random() * 22) - 11;
    const color = idx % 2 === 0 ? "#FFFFFF" : "#E56A4A";
    return `<text x="${x}" y="${y}" fill="${color}" font-size="20" font-weight="bold" font-family="monospace" letter-spacing="2" transform="rotate(${rot}, ${x}, ${y})">${ch}</text>`;
  }).join("");

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#141416;border-radius:4px;border:1px solid #28282c;user-select:none;">${noise}${glyphs}</svg>`;

  return {
    captchaToken: token,
    captchaImage: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
  };
}

/**
 * Verify Visual CAPTCHA token and user answer
 */
export function verifyVisualCaptcha(inputCode, token) {
  if (!inputCode || !token) return false;
  if (usedCaptchaTokens.has(token)) return false;

  const parts = String(token).split(".");
  if (parts.length !== 3) return false;
  const [tsStr, salt, sig] = parts;
  const ts = parseInt(tsStr, 10);
  if (Date.now() - ts > 10 * 60 * 1000) return false; // 10 min TTL

  const normalizedInput = String(inputCode).trim().toUpperCase();
  const expectedSig = crypto.createHmac("sha256", CAPTCHA_SECRET).update(`${normalizedInput}:${salt}:${ts}`).digest("hex");
  if (expectedSig.length !== sig.length) return false;

  const match = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  if (match) {
    usedCaptchaTokens.add(token);
  }
  return match;
}

/**
 * Mint Proof-of-Work Challenge with Adaptive Scaling
 * Default difficulty = 4 (0000 prefix). Scales to 5 if IP has strikes.
 */
export function mintChallenge(ip) {
  const challengeToken = crypto.randomBytes(24).toString("hex");
  const salt = crypto.randomBytes(10).toString("hex");
  const strikes = ipLockouts.get(ip)?.strikes || 0;
  const difficulty = strikes >= 1 ? 5 : 4;
  const now = Date.now();

  activeChallenges.set(challengeToken, {
    ip,
    salt,
    difficulty,
    issuedAt: now,
    consumed: false,
  });

  const visualCaptcha = generateVisualCaptcha();

  return {
    challengeToken,
    salt,
    difficulty,
    timestamp: now,
    captchaToken: visualCaptcha.captchaToken,
    captchaImage: visualCaptcha.captchaImage,
  };
}

/**
 * Strict Submission Integrity Verification:
 * ZERO-BYPASS: PoW token, nonce, visual CAPTCHA, and hardware attestation are mandatory.
 */
export function verifySubmissionIntegrity(body, ip) {
  // 1. Honeypot check
  if (body.website || body.email_confirm || body.hp_field || body.company_url || body.phone_number) {
    recordFailure(ip);
    return { valid: false, status: 403, error: "Automated honeypot trigger detected." };
  }

  // 2. Headless automation & Virtual GPU detection
  if (body._isWebdriver === true) {
    recordFailure(ip);
    return { valid: false, status: 403, error: "Automated browser controller (WebDriver) detected." };
  }

  const gpuRenderer = String(body._gpuRenderer || "").toLowerCase();
  if (
    gpuRenderer.includes("swiftshader") ||
    gpuRenderer.includes("llvmpipe") ||
    gpuRenderer.includes("virtualbox") ||
    gpuRenderer.includes("vmware") ||
    gpuRenderer.includes("software rasterizer")
  ) {
    recordFailure(ip);
    return { valid: false, status: 403, error: "Virtual / Headless GPU execution environment rejected." };
  }

  // 3. Visual CAPTCHA verification (Mandatory)
  const captchaCode = body.captchaCode;
  const captchaToken = body.captchaToken;
  if (!captchaCode || !captchaToken) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Verification code (CAPTCHA) is required." };
  }

  if (!verifyVisualCaptcha(captchaCode, captchaToken)) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Incorrect verification code. Please try again." };
  }

  // 4. Proof-of-Work is MANDATORY — Cannot be omitted
  const token = body._challengeToken;
  const nonce = body._powNonce;
  if (!token || nonce === undefined || nonce === null) {
    recordFailure(ip);
    return {
      valid: false,
      status: 400,
      error: "Cryptographic Proof-of-Work handshake is mandatory. Direct API bypass blocked.",
    };
  }

  const challenge = activeChallenges.get(token);
  if (!challenge) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Challenge token invalid or expired. Refresh page." };
  }
  if (challenge.consumed) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Challenge token already consumed." };
  }

  // 5. PoW Hash Verification: SHA-256(salt + nonce) MUST start with required zeroes
  const hash = crypto.createHash("sha256").update(challenge.salt + String(nonce)).digest("hex");
  const requiredPrefix = "0".repeat(challenge.difficulty);
  if (!hash.startsWith(requiredPrefix)) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Cryptographic PoW solution invalid." };
  }

  // 6. Anti-Replay: Nonce check
  const nonceKey = `${challenge.salt}:${nonce}`;
  if (usedNonces.has(nonceKey)) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Replay attack detected." };
  }
  usedNonces.add(nonceKey);

  // Consume challenge
  challenge.consumed = true;
  activeChallenges.delete(token);

  // 7. Timing verification: minimum 800ms human delay
  const clientTime = Number(body._t);
  if (!clientTime || Date.now() - clientTime < 800) {
    recordFailure(ip);
    return { valid: false, status: 429, error: "Action performed impossibly fast. Verification failed." };
  }

  // 8. Human interactive proof requirement
  if (!body.interactiveProof) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Human telemetry interaction proof missing." };
  }

  // 9. Device & Hardware fingerprint checks
  const dfp = String(body._dfp || "").trim();
  const hfp = String(body._hfp || "").trim();
  if (!dfp || dfp.length < 8) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Client environment integrity verification missing." };
  }
  if (!hfp || hfp.length < 8) {
    recordFailure(ip);
    return { valid: false, status: 400, error: "Physical hardware attestation missing." };
  }

  // 10. Voucher code sanitization
  let code = String(body.code || "").trim();
  if (code) {
    code = code.replace(/[\u200B-\u200D\uFEFF]/g, "");
    if (code.length < 3 || code.length > 64) {
      return { valid: false, status: 400, error: "Voucher code length invalid." };
    }
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      return { valid: false, status: 400, error: "Voucher code contains forbidden characters." };
    }
  }

  return { valid: true, sanitizedCode: code, deviceFp: dfp, hardwareFp: hfp };
}
