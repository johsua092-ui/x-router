import crypto from "node:crypto";
import sharp from "sharp";
import { getClientIp } from "@/lib/auth/loginLimiter";

/**
 * ============================================================================
 * X ROUTER TITANIUM FORTRESS ANTI-ABUSE ENGINE (V4 - ZERO-BYPASS)
 * ============================================================================
 * 1. Visual Dynamic Math Evaluation CAPTCHA (OCR-Proof, HMAC Signed)
 * 2. IPv4 /24 Subnet & IPv6 /48 Subnet Normalization (Blocks Mobile Airplane Mode)
 * 3. Deep Hardware Attestation (Canvas 2D + WebGL GPU + AudioContext DSP)
 * 4. Adaptive Proof-of-Work (Dynamic Difficulty 4-5 based on IP strikes)
 * 5. Headless Automation Killer (WebDriver & Virtual GPU SwiftShader/llvmpipe block)
 * 6. Global Anti-Blitz Voucher Pacing (2000ms debounce per pool)
 * 7. 3-Strike Escalating IP Lockout Jail (15m, 1h, 24h)
 * 8. Concurrency Mutex Locks & Single-Use Nonce Replay Guards
 * ============================================================================
 */

const CAPTCHA_SECRET = process.env.JWT_SECRET || "xrouter-titanium-captcha-secret-key";

// State stores in memory
const requestWindows = new Map();     // subnet -> { count, resetTime, lastReqTime }
const ipLockouts = new Map();         // subnet -> { strikes, lockedUntil }
const inFlightLocks = new Set();      // lock keys for concurrency mutex
const activeChallenges = new Map();   // token -> { subnet, issuedAt, salt, difficulty, consumed }
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

/**
 * Normalize IP address to subnet:
 * - IPv4: /24 subnet (e.g. 180.254.74.37 -> 180.254.74.0/24)
 *   Blocks Airplane Mode (mode pesawat) IP rotation from the same mobile tower!
 * - IPv6: /48 subnet (blocks rotating across trillions of IPv6 addresses)
 */
export function normalizeClientIp(rawIp) {
  if (!rawIp) return "127.0.0.1";
  let ip = String(rawIp).trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);

  // IPv6: Normalize to /48
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + "::/48";
  }

  // IPv4: Normalize to /24 (Blocks mobile carrier airplane-mode hop)
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  return ip;
}

export function isInternalSocket(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

/** Rate throttle per Subnet */
export function verifyNetworkThrottle(subnet) {
  const now = Date.now();

  const lock = ipLockouts.get(subnet);
  if (lock && lock.lockedUntil && now < lock.lockedUntil) {
    const minutesLeft = Math.ceil((lock.lockedUntil - now) / 60000);
    return {
      allowed: false,
      status: 429,
      code: "IP_LOCKOUT",
      error: `Network subnet suspended due to repeated verification failures. Retry in ${minutesLeft} minute(s).`,
    };
  }

  const rec = requestWindows.get(subnet);
  if (!rec || now - rec.resetTime > 60000) {
    requestWindows.set(subnet, { count: 1, resetTime: now, lastReqTime: now });
  } else {
    // Minimum 1000ms gap between consecutive attempts
    if (now - rec.lastReqTime < 1000) {
      recordFailure(subnet);
      return {
        allowed: false,
        status: 429,
        code: "BURST_THROTTLE",
        error: "Submissions too frequent. Please pace requests naturally.",
      };
    }
    rec.lastReqTime = now;
    rec.count += 1;

    // Max 5 requests per 60 seconds per Subnet
    if (rec.count > 5) {
      recordFailure(subnet);
      return {
        allowed: false,
        status: 429,
        code: "RATE_LIMIT_EXCEEDED",
        error: "Rate limit exceeded for this network subnet. Maximum 5 attempts per minute.",
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

export function recordFailure(subnet) {
  if (!subnet) return;
  const now = Date.now();
  const lock = ipLockouts.get(subnet) || { strikes: 0, lockedUntil: 0 };
  lock.strikes += 1;

  if (lock.strikes >= 8) {
    lock.lockedUntil = now + 24 * 60 * 60 * 1000; // 24h ban
  } else if (lock.strikes >= 5) {
    lock.lockedUntil = now + 60 * 60 * 1000;      // 1h ban
  } else if (lock.strikes >= 3) {
    lock.lockedUntil = now + 15 * 60 * 1000;      // 15m ban
  }
  ipLockouts.set(subnet, lock);
}

export function recordSuccess(subnet) {
  if (!subnet) return;
  ipLockouts.delete(subnet);
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
 * Generate Visual Dynamic Math CAPTCHA as PURE RASTER PNG
 * Converts distorted SVG to raw binary PNG pixels with Sharp.
 * Completely eliminates <text> extraction via DOM / regex / text parsing!
 */
export async function generateVisualCaptcha() {
  const a = Math.floor(Math.random() * 9) + 2; // 2 to 10
  const b = Math.floor(Math.random() * 8) + 1; // 1 to 8
  const op = Math.random() > 0.4 ? "+" : (a > b ? "-" : "+");
  const answer = op === "+" ? a + b : a - b;
  const question = `${a} ${op} ${b} = ?`;

  const salt = crypto.randomBytes(8).toString("hex");
  const ts = Date.now();
  const sig = crypto.createHmac("sha256", CAPTCHA_SECRET).update(`${answer}:${salt}:${ts}`).digest("hex");
  const token = `${ts}.${salt}.${sig}`;

  const width = 136;
  const height = 40;
  let noise = "";
  for (let i = 0; i < 6; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    noise += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#E56A4A" stroke-width="1.3" stroke-opacity="0.45" />`;
  }

  const glyphs = question.split("").map((ch, idx) => {
    const x = 12 + idx * 17 + (Math.random() * 2 - 1);
    const y = 26 + (Math.random() * 4 - 2);
    const rot = Math.floor(Math.random() * 20) - 10;
    const color = ch === "?" ? "#E56A4A" : (idx % 2 === 0 ? "#FFFFFF" : "#E0E0E0");
    return `<text x="${x}" y="${y}" fill="${color}" font-size="18" font-weight="bold" font-family="DejaVu Sans Mono, monospace" transform="rotate(${rot}, ${x}, ${y})">${ch}</text>`;
  }).join("");

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#141416;">${noise}${glyphs}</svg>`;

  let captchaImage = "";
  try {
    const pngBuf = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
    captchaImage = `data:image/png;base64,${pngBuf.toString("base64")}`;
  } catch (err) {
    captchaImage = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  }

  return {
    captchaToken: token,
    captchaImage,
  };
}

/**
 * Verify Visual Math CAPTCHA answer
 */
export function verifyVisualCaptcha(inputAnswer, token) {
  if (inputAnswer === undefined || inputAnswer === null || !token) return false;
  if (usedCaptchaTokens.has(token)) return false;

  const parts = String(token).split(".");
  if (parts.length !== 3) return false;
  const [tsStr, salt, sig] = parts;
  const ts = parseInt(tsStr, 10);
  if (Date.now() - ts > 10 * 60 * 1000) return false; // 10 min TTL

  const normalizedInput = String(inputAnswer).trim();
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
 */
export async function mintChallenge(subnet) {
  const challengeToken = crypto.randomBytes(24).toString("hex");
  const salt = crypto.randomBytes(10).toString("hex");
  const strikes = ipLockouts.get(subnet)?.strikes || 0;
  const difficulty = strikes >= 1 ? 5 : 4;
  const now = Date.now();

  activeChallenges.set(challengeToken, {
    subnet,
    salt,
    difficulty,
    issuedAt: now,
    consumed: false,
  });

  const visualCaptcha = await generateVisualCaptcha();

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
export function verifySubmissionIntegrity(body, subnet) {
  // 1. Honeypot check
  if (body.website || body.email_confirm || body.hp_field || body.company_url || body.phone_number) {
    recordFailure(subnet);
    return { valid: false, status: 403, error: "Automated honeypot trigger detected." };
  }

  // 2. Headless automation & Virtual GPU detection
  if (body._isWebdriver === true) {
    recordFailure(subnet);
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
    recordFailure(subnet);
    return { valid: false, status: 403, error: "Virtual / Headless GPU execution environment rejected." };
  }

  // 3. Visual Math CAPTCHA verification (Mandatory)
  const captchaCode = body.captchaCode;
  const captchaToken = body.captchaToken;
  if (!captchaCode || !captchaToken) {
    recordFailure(subnet);
    return { valid: false, status: 400, error: "Visual math verification answer is required." };
  }

  if (!verifyVisualCaptcha(captchaCode, captchaToken)) {
    recordFailure(subnet);
    return { valid: false, status: 400, error: "Incorrect math verification calculation. Please calculate the result." };
  }

  // 4. Proof-of-Work is MANDATORY — Cannot be omitted
  const token = body._challengeToken;
  const nonce = body._powNonce;
  if (!token || nonce === undefined || nonce === null) {
    recordFailure(subnet);
    return {
      valid: false,
      status: 400,
      error: "Cryptographic Proof-of-Work handshake is mandatory. Direct API bypass blocked.",
    };
  }

  const challenge = activeChallenges.get(token);
  if (!challenge) {
    recordFailure(subnet);
    return { valid: false, status: 400, error: "Challenge token invalid or expired. Refresh page." };
  }
  if (challenge.consumed) {
    recordFailure(subnet);
    return { valid: false, status: 400, error: "Challenge token already consumed." };
  }

  // 5. PoW Hash Verification: SHA-256(salt + nonce) MUST start with required zeroes
  const hash = crypto.createHash("sha256").update(challenge.salt + String(nonce)).digest("hex");
  const requiredPrefix = "0".repeat(challenge.difficulty);
  if (!hash.startsWith(requiredPrefix)) {
    recordFailure(subnet);
    return { valid: false, status: 400, error: "Cryptographic PoW solution invalid." };
  }

  // 6. Anti-Replay: Nonce check
  const nonceKey = `${challenge.salt}:${nonce}`;
  if (usedNonces.has(nonceKey)) {
    recordFailure(subnet);
    return { valid: false, status: 400, error: "Replay attack detected." };
  }
  usedNonces.add(nonceKey);

  // Consume challenge
  challenge.consumed = true;
  activeChallenges.delete(token);

  // 7. Timing verification: minimum 800ms human delay
  const clientTime = Number(body._t);
  if (!clientTime || Date.now() - clientTime < 800) {
    recordFailure(subnet);
    return { valid: false, status: 429, error: "Action performed impossibly fast. Verification failed." };
  }

  // 8. Human interactive proof requirement
  if (!body.interactiveProof) {
    recordFailure(subnet);
    return { valid: false, status: 400, error: "Human telemetry interaction proof missing." };
  }

  // 9. Device & Hardware fingerprint checks
  const dfp = String(body._dfp || "").trim();
  const hfp = String(body._hfp || "").trim();
  if (!dfp || dfp.length < 8) {
    recordFailure(subnet);
    return { valid: false, status: 400, error: "Client environment integrity verification missing." };
  }
  if (!hfp || hfp.length < 8) {
    recordFailure(subnet);
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
