import { NextResponse } from "next/server";
import { claimVoucher, getVoucherByCode, getActiveBansosVoucher } from "@/lib/localDb";
import { getClientIp } from "@/lib/auth/loginLimiter";

// ─── 10-LAYER ANTI-ABUSE ENGINE FOR VOUCHER CLAIMS ──────────────────────────

// Layer 1: Sliding window rate limiter (max 5 requests per minute per IP)
const requestTracker = new Map();
const REQ_WINDOW = 60 * 1000;
const MAX_REQ_PER_MIN = 5;

// Layer 2: Progressive IP Lockout & Jail (lockout after 4 failed guesses)
const failedAttempts = new Map(); // ip -> { count, lockedUntil }
const MAX_FAILED_ATTEMPTS = 4;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes jail

function checkRateAndLockout(ip) {
  if (!ip) return null;
  const now = Date.now();

  const lock = failedAttempts.get(ip);
  if (lock && lock.lockedUntil && now < lock.lockedUntil) {
    const minutesLeft = Math.ceil((lock.lockedUntil - now) / 60000);
    return `Access temporarily suspended due to suspicious activity. Try again in ${minutesLeft} minute(s).`;
  }

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
    lock.count = 0;
  }
  failedAttempts.set(ip, lock);
}

function clearFailure(ip) {
  if (!ip) return;
  failedAttempts.delete(ip);
}

// GET /api/vouchers/claim -> checks if there is an active bansos pool or inspects specific code
export async function GET(request) {
  try {
    const clientIp = getClientIp(request) || "";
    const blockedReason = checkRateAndLockout(clientIp);
    if (blockedReason) {
      return NextResponse.json({ error: blockedReason }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    // If specific code requested
    if (code) {
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
          isBansos: voucher.isBansos,
          isAvailable,
        },
      });
    }

    // Otherwise check for active Bansos pool
    const bansosVoucher = await getActiveBansosVoucher();
    return NextResponse.json({
      hasActiveBansos: !!bansosVoucher,
      bansos: bansosVoucher
        ? {
            name: bansosVoucher.name,
            description: bansosVoucher.description,
            tokenLimit: bansosVoucher.tokenLimit,
            allowedModels: bansosVoucher.allowedModels,
            expiresInDays: bansosVoucher.expiresInDays,
            remainingClaims: bansosVoucher.maxUses === 0 ? "Unlimited" : Math.max(0, bansosVoucher.maxUses - bansosVoucher.usedCount),
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/vouchers/claim -> executes claim (either 1-Click Bansos or Code)
export async function POST(request) {
  try {
    const clientIp = getClientIp(request) || "";

    // Layer 1 & 2: Rate limit & lockout check
    const blockedReason = checkRateAndLockout(clientIp);
    if (blockedReason) {
      return NextResponse.json({ error: blockedReason }, { status: 429 });
    }

    const body = await request.json();

    // Layer 3: Honeypot bot trap
    if (body.website || body.email_confirm || body.hp || body.company_url) {
      recordFailure(clientIp);
      return NextResponse.json({ error: "Automated submission detected" }, { status: 403 });
    }

    // Layer 4: Human timing check
    const clientTimestamp = Number(body._t);
    if (clientTimestamp && Date.now() - clientTimestamp < 400) {
      recordFailure(clientIp);
      return NextResponse.json({ error: "Submission too fast. Please verify you are human." }, { status: 429 });
    }

    let code = String(body.code || "").trim();
    const isBansosRequest = body.isBansos === true || !code;

    // If 1-Click Bansos mode: automatically find the active Bansos voucher!
    if (isBansosRequest) {
      const bansosVoucher = await getActiveBansosVoucher();
      if (!bansosVoucher) {
        return NextResponse.json(
          { error: "Currently no active Bansos voucher pool available.", code: "NO_ACTIVE_BANSOS" },
          { status: 404 }
        );
      }
      code = bansosVoucher.code;
    }

    // Layer 5 to 10: Atomic claim execution with DB-level duplicate IP check and daily cap
    const result = await claimVoucher(code, clientIp);
    if (!result.success) {
      if (result.error === "VOUCHER_NOT_FOUND") {
        recordFailure(clientIp);
      }
      return NextResponse.json({ error: result.message, code: result.error }, { status: 400 });
    }

    clearFailure(clientIp);

    // Determine base URL
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "xrouter.consoleapi.qzz.io";
    const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
    const baseUrl = `${proto}://${host}/v1`;

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
    console.error("Error executing claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
