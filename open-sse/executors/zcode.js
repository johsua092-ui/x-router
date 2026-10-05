import { BaseExecutor } from "./base.js";

const ZCODE_BASE = "https://zcode.z.ai";
const ZCODE_PLAN_ANTHROPIC = `${ZCODE_BASE}/api/v1/zcode-plan/anthropic/v1/messages`;
const ZCODE_PLAN_OPENAI = `${ZCODE_BASE}/api/v1/zcode-plan/chat/completions`;
const ZCODE_BILLING_BALANCE = `${ZCODE_BASE}/api/v1/zcode-plan/billing/balance?app_version=3.14.3`;

const DESKTOP_HEADERS = {
  "User-Agent": "ZCode/3.14.3 (Windows NT 10.0; Win64; x64) Electron/33.2.1",
  "X-Client-Version": "3.14.3",
  "anthropic-version": "2023-06-01",
  Accept: "text/event-stream, application/json, text/plain, */*",
  "Content-Type": "application/json",
  Origin: ZCODE_BASE,
  Referer: `${ZCODE_BASE}/`,
};

export function extractZCodeToken(raw) {
  if (!raw) return "";
  let str = String(raw).trim();
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed?.zcodeJwtToken === "string") return parsed.zcodeJwtToken.trim();
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
      headers: {
        ...DESKTOP_HEADERS,
        Authorization: `Bearer ${jwt}`,
      },
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
      raw: data,
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
    const jwtToken = extractZCodeToken(rawCreds.apiKey || rawCreds.token);

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
    } else {
      messages = [{ role: "user", content: String(bodyObj.prompt || "") }];
    }

    if (messages.length === 0) {
      messages.push({ role: "user", content: "Hello" });
    }

    const anthropicPayload = {
      model: modelId,
      messages,
      ...(systemPrompt.trim() ? { system: systemPrompt.trim() } : {}),
      max_tokens: bodyObj.max_tokens || bodyObj.maxTokens || 4096,
      stream: Boolean(stream),
      ...(typeof bodyObj.temperature === "number" ? { temperature: bodyObj.temperature } : {}),
    };

    const headers = {
      ...DESKTOP_HEADERS,
      Authorization: `Bearer ${jwtToken}`,
    };

    let upstreamRes;
    try {
      upstreamRes = await fetch(ZCODE_PLAN_ANTHROPIC, {
        method: "POST",
        headers,
        body: JSON.stringify(anthropicPayload),
        signal,
      });
    } catch (err) {
      return {
        response: errorResponse(502, `Failed to connect to ZCode upstream: ${err.message}`),
        url: ZCODE_PLAN_ANTHROPIC,
        headers: {},
        transformedBody: anthropicPayload,
      };
    }

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => "");
      return {
        response: errorResponse(upstreamRes.status, `ZCode upstream error (${upstreamRes.status}): ${errText.slice(0, 300)}`),
        url: ZCODE_PLAN_ANTHROPIC,
        headers: {},
        transformedBody: anthropicPayload,
      };
    }

    const id = `chatcmpl-zcd-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    if (stream) {
      const encoder = new TextEncoder();
      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder("utf-8");

      const readable = new ReadableStream({
        async start(controller) {
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(":")) continue;

                if (trimmed.startsWith("data:")) {
                  const dataStr = trimmed.slice(5).trim();
                  if (dataStr === "[DONE]") continue;

                  try {
                    const parsed = JSON.parse(dataStr);
                    // Handle Anthropic stream events: content_block_delta or text
                    let deltaText = "";
                    if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                      deltaText = parsed.delta.text || "";
                    } else if (parsed.choices?.[0]?.delta?.content) {
                      deltaText = parsed.choices[0].delta.content;
                    } else if (parsed.text) {
                      deltaText = parsed.text;
                    }

                    if (deltaText) {
                      const sseChunk = {
                        id,
                        object: "chat.completion.chunk",
                        created,
                        model: modelId,
                        choices: [
                          {
                            index: 0,
                            delta: { content: deltaText },
                            finish_reason: null,
                          },
                        ],
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
                    }
                  } catch {}
                }
              }
            }

            const finalChunk = {
              id,
              object: "chat.completion.chunk",
              created,
              model: modelId,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: "stop",
                },
              ],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return {
        response: new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }),
        url: ZCODE_PLAN_ANTHROPIC,
        headers: {},
        transformedBody: anthropicPayload,
      };
    }

    // Non-streaming mode
    const jsonRes = await upstreamRes.json().catch(() => null);
    let fullText = "";
    if (jsonRes?.content) {
      if (Array.isArray(jsonRes.content)) {
        fullText = jsonRes.content.map((c) => c.text || "").join("");
      } else if (typeof jsonRes.content === "string") {
        fullText = jsonRes.content;
      }
    } else if (jsonRes?.choices?.[0]?.message?.content) {
      fullText = jsonRes.choices[0].message.content;
    }

    const completion = {
      id,
      object: "chat.completion",
      created,
      model: modelId,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: fullText,
          },
          finish_reason: "stop",
        },
      ],
      usage: jsonRes?.usage || {
        prompt_tokens: 0,
        completion_tokens: fullText.length / 4,
        total_tokens: fullText.length / 4,
      },
    };

    return {
      response: new Response(JSON.stringify(completion), {
        headers: { "Content-Type": "application/json" },
      }),
      url: ZCODE_PLAN_ANTHROPIC,
      headers: {},
      transformedBody: anthropicPayload,
    };
  }
}
