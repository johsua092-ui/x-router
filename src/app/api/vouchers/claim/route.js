import { NextResponse } from "next/server";
import { claimVoucher, getVoucherByCode, getActiveBansosVoucher } from "@/lib/localDb";
import { getClientIp } from "@/lib/auth/loginLimiter";
import {
  normalizeClientIp,
  verifyNetworkThrottle,
  verifyClientFingerprint,
  verifySubmissionIntegrity,
  mintChallenge,
  recordFailure,
  recordSuccess,
  acquireConcurrencyLock,
  releaseConcurrencyLock,
  clearAllLockouts,
} from "@/lib/security/antiAbuseEngine";

clearAllLockouts();

// GET /api/vouchers/claim -> checks if there is an active bansos pool, inspects specific code, and mints PoW challenge
export async function GET(request) {
  try {
    // Edge Proxy Gate: Enforce Cloudflare Edge for all external public traffic
    const host = request.headers.get("host") || "";
    const isLocal = host.startsWith("127.0.0.1") || host.startsWith("localhost");
    const cfRay = request.headers.get("cf-ray");
    if (!isLocal && !cfRay) {
      return NextResponse.json(
        { error: "Direct IP connection prohibited. Requests must route through Cloudflare Edge proxy." },
        { status: 403 }
      );
    }

    const cfIp = request.headers.get("cf-connecting-ip");
    const rawIp = (cfIp && cfIp.trim()) ? cfIp.trim() : (getClientIp(request) || "");
    const ip = normalizeClientIp(rawIp);

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    // Always mint PoW challenge for the client
    const challengeData = await mintChallenge(ip);

    // If specific code inspection requested
    if (code) {
      const voucher = await getVoucherByCode(code);
      if (!voucher) {
        recordFailure(ip);
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
        challenge: challengeData,
      });
    }

    // Check for active community faucet
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
      challenge: challengeData,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/vouchers/claim -> Bulletproof Anti-Abuse Protected Claim Handler
export async function POST(request) {
  // Edge Proxy Gate: Enforce Cloudflare Edge for all external public traffic
  const host = request.headers.get("host") || "";
  const isLocal = host.startsWith("127.0.0.1") || host.startsWith("localhost");
  const cfRay = request.headers.get("cf-ray");
  if (!isLocal && !cfRay) {
    return NextResponse.json(
      { error: "Direct IP connection prohibited. Requests must route through Cloudflare Edge proxy." },
      { status: 403 }
    );
  }

  const cfIp = request.headers.get("cf-connecting-ip");
  const rawIp = (cfIp && cfIp.trim()) ? cfIp.trim() : (getClientIp(request) || "");
  const ip = normalizeClientIp(rawIp);
  const lockKey = `claim_lock:${ip}`;
  let hwLockKey = null;

  // Server-side HttpOnly cookie check (stops instant multi-claim loops on same browser)
  const claimedCookie = request.cookies.get("xr_vclaim_status");
  if (claimedCookie && claimedCookie.value === "claimed") {
    return NextResponse.json(
      { error: "Perangkat ini sudah pernah mengklaim voucher (Sesi browser terkunci)." },
      { status: 400 }
    );
  }

  // Concurrent Request Mutex Lock (prevents parallel race conditions per IP)
  if (!acquireConcurrencyLock(lockKey)) {
    return NextResponse.json(
      { error: "Another transaction from your network is currently in progress." },
      { status: 429 }
    );
  }

  try {
    // 1. Network & IP Integrity Checks
    const throttle = verifyNetworkThrottle(ip);
    if (!throttle.allowed) {
      return NextResponse.json({ error: throttle.error }, { status: throttle.status });
    }

    // 2. Client & Protocol Fingerprinting
    const clientCheck = verifyClientFingerprint(request);
    if (!clientCheck.valid) {
      recordFailure(ip);
      return NextResponse.json({ error: clientCheck.error }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));

    // 3. Behavioral, Proof-of-Work & Cryptographic Integrity (MANDATORY POW + TURNSTILE)
    const integrity = await verifySubmissionIntegrity(body, ip);
    if (!integrity.valid) {
      return NextResponse.json({ error: integrity.error }, { status: integrity.status });
    }

    let code = integrity.sanitizedCode;
    const isBansosRequest = body.isBansos === true || !code;
    const deviceFp = integrity.deviceFp;
    const hardwareFp = integrity.hardwareFp;

    // Concurrent Hardware Mutex Lock (prevents race conditions from multiple IPs with same hardware)
    if (hardwareFp) {
      hwLockKey = `claim_hw_lock:${hardwareFp}`;
      if (!acquireConcurrencyLock(hwLockKey)) {
        return NextResponse.json(
          { error: "Another transaction on this physical device is currently in progress." },
          { status: 429 }
        );
      }
    }

    // Resolve code for 1-Click Faucet
    if (isBansosRequest) {
      const bansosVoucher = await getActiveBansosVoucher();
      if (!bansosVoucher) {
        return NextResponse.json(
          { error: "No active community faucet slot available.", code: "NO_ACTIVE_FAUCET" },
          { status: 404 }
        );
      }
      code = bansosVoucher.code;
    }

    // 4. Database & Identity Quota Locking
    const result = await claimVoucher(code, ip, deviceFp, hardwareFp);
    if (!result.success) {
      if (result.error === "VOUCHER_NOT_FOUND") {
        recordFailure(ip);
      }
      return NextResponse.json({ error: result.message, code: result.error }, { status: 400 });
    }

    recordSuccess(ip);

    // Determine Base URL
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

    const response = NextResponse.json({
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

    // Set 1-year HttpOnly cookie lock
    response.cookies.set("xr_vclaim_status", "claimed", {
      path: "/",
      maxAge: 31536000,
      httpOnly: true,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Error executing bulletproof claim:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    releaseConcurrencyLock(lockKey);
    if (hwLockKey) releaseConcurrencyLock(hwLockKey);
  }
}
