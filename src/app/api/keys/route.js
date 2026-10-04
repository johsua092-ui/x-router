import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionUser, newApiKey, listApiKeys, revokeApiKey } from "@/lib/db";

export const dynamic = "force-dynamic";

function authed() {
  return sessionUser(cookies().get("xr_session")?.value);
}

export async function GET() {
  if (!authed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ keys: listApiKeys() });
}

export async function POST(req) {
  if (!authed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let name = "default";
  try {
    const b = await req.json();
    if (b?.name) name = String(b.name).slice(0, 64);
  } catch { /* default */ }
  const key = newApiKey(name);
  return NextResponse.json({ ok: true, key });
}

export async function DELETE(req) {
  if (!authed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let key = "";
  try {
    const b = await req.json();
    key = String(b?.key || "");
  } catch { /* noop */ }
  if (!key) return NextResponse.json({ error: "key wajib" }, { status: 400 });
  revokeApiKey(key);
  return NextResponse.json({ ok: true });
}
