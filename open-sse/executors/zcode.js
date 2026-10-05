import { BaseExecutor } from "./base.js";
import crypto from "node:crypto";

const ZCODE_BASE = "https://zcode.z.ai";
const ZCODE_PLAN_ANTHROPIC = `${ZCODE_BASE}/api/v1/zcode-plan/anthropic/v1/messages`;
const ZCODE_ULTRA_ZAI = `${ZCODE_BASE}/api/v1/ultra-zai/anthropic/v1/messages`;
const ZAI_OFFICIAL_API = "https://api.z.ai/api/anthropic/v1/messages?beta=true";
const ZCODE_BILLING_BALANCE = `${ZCODE_BASE}/api/v1/zcode-plan/billing/balance?app_version=3.14.3`;

// Persistent desktop device hardware MID
const DESKTOP_DEVICE_MID = "7e5d2c18-912b-42fa-9082-8c1e405e3214";

export function buildDesktopHeaders(extra = {}) {
  const reqId = crypto.randomUUID();
  return {
    "User-Agent": "ZCode/3.14.3 (Windows NT 10.0; Win64; x64) Electron/33.2.1",
    "HTTP-Referer": "https://zcode.z.ai",
    Origin: "https://zcode.z.ai",
    Referer: "https://zcode.z.ai/",
    "X-Title": "Z Code@electron",
    "X-Client-Version": "3.14.3",
    "X-ZCode-App-Version": "3.14.3",
    "X-Platform": "win32-x64",
    "X-Release-Channel": "stable",
    "X-Client-Language": "en-US",
    "X-Client-Timezone": "Asia/Jakarta",
    "X-Os-Category": "windows",
    "X-Os-Version": "10.0.22631",
    "X-Device-Mid": DESKTOP_DEVICE_MID,
    "X-ZCode-Agent": "glm",
    "x-request-id": reqId,
    "sec-ch-ua": '"Chromium";v="130", "ZCode";v="3.14.3", "Not?A_Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Site": "same-site",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    Accept: "text/event-stream, application/json;q=0.9, */*;q=0.8",
    "anthropic-version": "2023-06-01",
    ...extra,
  };
}

export function extractZCodeToken(raw) {
  if (!raw) return "";
  if (typeof raw === "object") {
    if (typeof raw?.providerSpecificData?.zcodeJwtToken === "string") return raw.providerSpecificData.zcodeJwtToken.trim();
    if (typeof raw?.zcodeJwtToken === "string") return raw.zcodeJwtToken.trim();
    if (typeof raw?.accessToken === "string" && raw.accessToken.startsWith("eyJ")) return raw.accessToken.trim();
    if (typeof raw?.apiKey === "string" && raw.apiKey.startsWith("eyJ")) return raw.apiKey.trim();
    if (typeof raw?.token === "string") return raw.token.trim();
    if (typeof raw?.accessToken === "string") return raw.accessToken.trim();
    if (typeof raw?.apiKey === "string") return raw.apiKey.trim();
  }
  let str = String(raw).trim();
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed?.providerSpecificData?.zcodeJwtToken === "string") return parsed.providerSpecificData.zcodeJwtToken.trim();
    if (typeof parsed?.zcodeJwtToken === "string") return parsed.zcodeJwtToken.trim();
    if (typeof parsed?.accessToken === "string") return parsed.accessToken.trim();
    if (typeof parsed?.token === "string") return parsed.token.trim();
    if (typeof parsed?.apiKey === "string") return parsed.apiKey.trim();
    if (typeof parsed?.value === "string") return parsed.value.trim();
  } catch {}
  if (str.startsWith("Bearer ")) str = str.slice(7).trim();
  return str.replace(/^["']|["']$/g, "").trim();
}

/**
 * Check Bansos / Start Plan Quota Balance
 */
export async function checkZCodeBansos(token) {
  const jwt = extractZCodeToken(token);
  if (!jwt) return { success: false, error: "No token provided" };

  try {
    const res = await fetch(ZCODE_BILLING_BALANCE, {
      method: "GET",
      headers: buildDesktopHeaders({
        Authorization: `Bearer ${jwt}`,
      }),
    });

    if (!res.ok) {
      return { success: false, status: res.status, error: await res.text() };
    }

    const data = await res.json();
    const plans = data.data?.plans || [];
    const activeStartPlan = plans.find(
      (p) =>
        p.status?.toLowerCase() === "active" &&
        (p.plan_id?.includes("start-plan") || p.name?.toLowerCase().includes("start plan"))
    );

    return {
      success: true,
      hasBansos: Boolean(activeStartPlan),
      plan: activeStartPlan || null,
      balances: data.data?.balances || [],
      serverTime: data.data?.server_time,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function errorResponse(status, message) {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: "zcode_error",
        code: status,
      },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export class ZCodeExecutor extends BaseExecutor {
  constructor() {
    super("zcode", { baseUrl: ZCODE_BASE });
  }

  async execute({ model, body, stream, credentials, signal }) {
    const bodyObj = body || {};
    const rawCreds = credentials || {};
    const jwtToken = extractZCodeToken(
      rawCreds.providerSpecificData?.zcodeJwtToken ||
      rawCreds.zcodeJwtToken ||
      rawCreds.accessToken ||
      rawCreds.apiKey ||
      rawCreds.token
    );
    const planApiKey = rawCreds.accessToken || rawCreds.apiKey || "";
    const userId = rawCreds.providerSpecificData?.userId || "";

    if (!jwtToken) {
      return {
        response: errorResponse(401, "ZCode JWT Token is required. Please authenticate via ZCode OAuth or paste zcodeJwtToken."),
        url: ZCODE_PLAN_ANTHROPIC,
        headers: {},
        transformedBody: body,
      };
    }

    const modelId = String(model || "").replace(/^(zcode\/|zai\/)/, "");

    // Format request payload for Anthropic Messages format
    let messages = [];
    let systemPrompt = "";

    if (Array.isArray(bodyObj.messages)) {
      for (const m of bodyObj.messages) {
        if (m.role === "system") {
          systemPrompt += (typeof m.content === "string" ? m.content : JSON.stringify(m.content)) + "\n";
        } else {
          messages.push({
            role: m.role === "assistant" ? "assistant" : "user",
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
          });
        }
      }
    }

    const anthropicPayload = {
      model: modelId || "GLM-5.3-Flash",
      messages: messages.length > 0 ? messages : [{ role: "user", content: "Hello" }],
      max_tokens: bodyObj.max_tokens || 4096,
      stream: stream ?? true,
      ...(systemPrompt.trim() ? { system: systemPrompt.trim() } : {}),
      ...(bodyObj.temperature !== undefined ? { temperature: bodyObj.temperature } : {}),
      ...(bodyObj.top_p !== undefined ? { top_p: bodyObj.top_p } : {}),
      metadata: {
        user_id: JSON.stringify({
          device_id: DESKTOP_DEVICE_MID,
          account_uuid: userId,
          session_id: crypto.randomUUID(),
        }),
      },
    };

    const targetUrl = ZCODE_PLAN_ANTHROPIC;
    const requestHeaders = buildDesktopHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
      ...(planApiKey ? { "X-Coding-Plan-Api-Key": planApiKey } : {}),
    });

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(anthropicPayload),
        signal,
      });

      // If zcode-plan returns 405 (unusual activity) and planApiKey exists, fallback to gateway
      if (response.status === 405 && planApiKey && planApiKey !== jwtToken) {
        const fallbackHeaders = {
          ...requestHeaders,
          Authorization: `Bearer ${planApiKey}`,
          "x-api-key": planApiKey,
        };
        const fallbackRes = await fetch(ZCODE_ULTRA_ZAI, {
          method: "POST",
          headers: fallbackHeaders,
          body: JSON.stringify(anthropicPayload),
          signal,
        });
        if (fallbackRes.ok) {
          return {
            response: fallbackRes,
            url: ZCODE_ULTRA_ZAI,
            headers: fallbackHeaders,
            transformedBody: anthropicPayload,
            responseFormat: "claude",
          };
        }
      }

      return {
        response,
        url: targetUrl,
        headers: requestHeaders,
        transformedBody: anthropicPayload,
        responseFormat: "claude",
      };
    } catch (err) {
      return {
        response: errorResponse(502, `Failed to connect to ZCode upstream: ${err.message}`),
        url: targetUrl,
        headers: requestHeaders,
        transformedBody: anthropicPayload,
      };
    }
  }
}
