import { NextResponse } from "next/server";
import { claimVoucher, getVoucherByCode } from "@/lib/localDb";
import { getClientIp } from "@/lib/auth/loginLimiter";

// ─── ANTI-ABUSE ENGINE FOR VOUCHER CLAIMS ─────────────────────────────────

// 1. Sliding window rate limiter for general claim requests (max 5 requests / min per IP)
const requestTracker = new Map();
const REQ_WINDOW = 60 * 1000;
const MAX_REQ_PER_MIN = 5;

// 2. Strict brute-force protection (lockout after 4 failed voucher code guesses)
const failedAttempts = new Map(); // ip -> { count, lockedUntil }
const MAX_FAILED_ATTEMPTS = 4;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes ban

function checkRateAndLockout(ip) {
  if (!ip) return null;
  const now = Date.now();

  // Check if IP is currently locked out
  const lock = failedAttempts.get(ip);
  if (lock && lock.lockedUntil && now < lock.lockedUntil) {
    const minutesLeft = Math.ceil((lock.lockedUntil - now) / 60000);
    return `Access temporarily suspended due to repeated invalid attempts. Try again in ${minutesLeft} minute(s).`;
  }

  // Check sliding window rate limit
  const rec = requestTracker.get(ip);
  if (!rec || now - rec.resetTime > REQ_WINDOW) {
    requestTracker.set(ip, { count: 1, resetTime: now });
  } else {
    rec.count += 1;
    if (rec.count > MAX_REQ_PER_MIN) {
      return "Rate limit exceeded. Too many requests. Please wait a minute.";
    }
  }

  return null;
}

function recordFailure(ip) {
  if (!ip) return;
  const now = Date.now();
  const lock = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  lock.count += 1;
  if (lock.count >= MAX_FAILED_ATTEMPTS) {
    lock.lockedUntil = now + LOCKOUT_DURATION;
    lock.count = 0; // reset counter after locking
  }
  failedAttempts.set(ip, lock);
}

function clearFailure(ip) {
  if (!ip) return;
  failedAttempts.delete(ip);
}

// GET /api/vouchers/claim?code=XXX -> inspect voucher public metadata without claiming
export async function GET(request) {
  try {
    const clientIp = getClientIp(request) || "";
    const blockedReason = checkRateAndLockout(clientIp);
    if (blockedReason) {
      return NextResponse.json({ error: blockedReason }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Missing voucher code parameter" }, { status: 400 });
    }

    const voucher = await getVoucherByCode(code);
    if (!voucher) {
      recordFailure(clientIp);
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }

    const isAvailable = voucher.isActive && (voucher.maxUses === 0 || voucher.usedCount < voucher.maxUses);

    return NextResponse.json({
      voucher: {
        code: voucher.code,
        name: voucher.name,
        description: voucher.description,
        tokenLimit: voucher.tokenLimit,
        allowedModels: voucher.allowedModels,
        expiresInDays: voucher.expiresInDays,
        maxUses: voucher.maxUses,
        usedCount: voucher.usedCount,
        isAvailable,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/vouchers/claim -> execute claim with multi-layered anti-abuse checks
export async function POST(request) {
  try {
    const clientIp = getClientIp(request) || "";

    // 1. Check IP rate-limiting & brute-force lockout
    const blockedReason = checkRateAndLockout(clientIp);
    if (blockedReason) {
      return NextResponse.json({ error: blockedReason }, { status: 429 });
    }

    const body = await request.json();

    // 2. Anti-Bot Honeypot trap (bots fill hidden form fields)
    if (body.website || body.email_confirm || body.hp) {
      recordFailure(clientIp);
      return NextResponse.json({ error: "Automated submission detected" }, { status: 403 });
    }

    // 3. Human timing validation (submissions under 400ms are automated scripts)
    const clientTimestamp = Number(body._t);
    if (clientTimestamp && Date.now() - clientTimestamp < 400) {
      recordFailure(clientIp);
      return NextResponse.json({ error: "Submission too fast. Please verify you are human." }, { status: 429 });
    }

    const code = String(body.code || "").trim();
    if (!code) {
      return NextResponse.json({ error: "Voucher code is required" }, { status: 400 });
    }

    // 4. Execute atomic claim with DB-level IP deduplication & daily quota
    const result = await claimVoucher(code, clientIp);
    if (!result.success) {
      if (result.error === "VOUCHER_NOT_FOUND") {
        recordFailure(clientIp);
      }
      return NextResponse.json({ error: result.message, code: result.error }, { status: 400 });
    }

    // Successful claim: reset failure count
    clearFailure(clientIp);

    // Determine base URL from request host
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "xrouter.consoleapi.qzz.io";
    const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
    const baseUrl = `${proto}://${host}/v1`;

    // Presets for instant setup
    const configs = {
      curl: `curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${result.apiKey}" \\
  -d '{"model": "${result.allowedModels === "*" ? "gpt-4o" : result.allowedModels.split(",")[0].trim()}", "messages": [{"role": "user", "content": "Hello!"}]}'`,

      python: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${result.apiKey}"
)

response = client.chat.completions.create(
    model="${result.allowedModels === "*" ? "gpt-4o" : result.allowedModels.split(",")[0].trim()}",
    messages=[{"role": "user", "content": "Hello X Router!"}]
)
print(response.choices[0].message.content)`,

      cursor: {
        apiUrl: baseUrl,
        apiKey: result.apiKey,
        instructions: "Paste into Cursor Settings -> Models -> OpenAI API Key & Base URL",
      },

      cline: {
        apiProvider: "openai",
        openAiBaseUrl: baseUrl,
        openAiApiKey: result.apiKey,
        openAiModelId: result.allowedModels === "*" ? "gpt-4o" : result.allowedModels.split(",")[0].trim(),
      },
    };

    return NextResponse.json({
      success: true,
      apiKey: result.apiKey,
      keyId: result.keyId,
      tokenLimit: result.tokenLimit,
      allowedModels: result.allowedModels,
      expiresAt: result.expiresAt,
      voucherName: result.voucherName,
      code: result.code,
      baseUrl,
      configs,
    });
  } catch (error) {
    console.error("Error executing voucher claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
