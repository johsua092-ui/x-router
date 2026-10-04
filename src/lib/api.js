import { NextResponse } from "next/server";
import { checkApiKey, addTokens } from "@/lib/db";
import { forward } from "@/lib/gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** ambil API key dari Authorization: Bearer / x-api-key */
export function apiKeyOf(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const xk = req.headers.get("x-api-key");
  if (xk) return xk.trim();
  return "";
}

export function denyInvalidKey(req) {
  const key = apiKeyOf(req);
  if (!checkApiKey(key)) {
    return NextResponse.json(
      { error: { message: "invalid api key", type: "authentication_error" } },
      { status: 401 }
    );
  }
  return { key };
}

/** catat token ke key pemanggil setelah usage diketahui */
export function credit(key, prompt, completion) {
  const n = (prompt || 0) + (completion || 0);
  if (n > 0) addTokens(key, n);
}

export async function handleChat(req, clientFormat, kind = "chat") {
  const gate = denyInvalidKey(req);
  if (gate instanceof NextResponse) return gate;

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: "invalid json body", type: "invalid_request_error" } },
      { status: 400 }
    );
  }
  if (!payload?.model) {
    return NextResponse.json(
      { error: { message: "field 'model' wajib diisi", type: "invalid_request_error" } },
      { status: 400 }
    );
  }

  const res = await forward({
    payload,
    clientFormat,
    kind,
    model: payload.model,
  });

  if (res.json) {
    return NextResponse.json(res.json, { status: res.status });
  }

  if (res.stream) {
    // SSE: relai stream apa adanya
    return new Response(res.stream, { status: res.status, headers: res.headers });
  }

  credit(gate.key, res.promptTokens, res.completionTokens);
  return new Response(res.body, { status: res.status, headers: res.headers });
}
