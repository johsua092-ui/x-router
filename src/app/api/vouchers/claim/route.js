import { NextResponse } from "next/server";
import { claimVoucher, getVoucherByCode } from "@/lib/localDb";
import { getClientIp } from "@/lib/auth/loginLimiter";

// Rate limiting map for voucher claims: max 10 attempts per IP per minute
const claimAttempts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_ATTEMPTS_PER_MIN = 10;

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const record = claimAttempts.get(ip);
  if (!record || now - record.resetTime > RATE_LIMIT_WINDOW) {
    claimAttempts.set(ip, { count: 1, resetTime: now });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS_PER_MIN;
}

// GET /api/vouchers/claim?code=XXX -> inspect voucher public metadata without claiming
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Missing voucher code parameter" }, { status: 400 });
    }

    const voucher = await getVoucherByCode(code);
    if (!voucher) {
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

// POST /api/vouchers/claim -> execute claim, returns scoped API key & exporter configs
export async function POST(request) {
  try {
    const clientIp = getClientIp(request) || "";
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: "Too many claim attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const code = String(body.code || "").trim();

    if (!code) {
      return NextResponse.json({ error: "Voucher code is required" }, { status: 400 });
    }

    const result = await claimVoucher(code, clientIp);
    if (!result.success) {
      return NextResponse.json({ error: result.message, code: result.error }, { status: 400 });
    }

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
