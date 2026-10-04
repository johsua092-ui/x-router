import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  sessionUser, listConnections, upsertConnection, deleteConnection,
} from "@/lib/db";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

function authed() {
  return sessionUser(cookies().get("xr_session")?.value);
}

export async function GET() {
  if (!authed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const conns = listConnections(undefined, false);
  // jangan bocorkan key penuh ke UI
  return NextResponse.json({
    connections: conns.map((c) => ({
      id: c.id,
      provider: c.provider,
      name: c.name,
      isActive: c.isActive,
      baseUrl: c.data?.baseUrl || null,
      keyMasked: mask(c.data?.apiKey),
      createdAt: c.createdAt,
    })),
  });
}

function mask(k) {
  if (!k) return "";
  const s = String(k);
  return s.length <= 8 ? "••••" + s.slice(-2) : "••••" + s.slice(-4);
}

export async function POST(req) {
  if (!authed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let b = {};
  try { b = await req.json(); } catch { /* noop */ }
  const provider = String(b.provider || "").trim();
  const apiKey = String(b.apiKey || "").trim();
  if (!provider || !apiKey) {
    return NextResponse.json({ error: "provider & api key wajib" }, { status: 400 });
  }
  const data = { apiKey };
  if (b.baseUrl) data.baseUrl = String(b.baseUrl).trim();
  const id = "conn-" + randomBytes(6).toString("hex");
  upsertConnection(id, provider, data, b.name || null);
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req) {
  if (!authed()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let id = "";
  try {
    const b = await req.json();
    id = String(b?.id || "");
  } catch { /* noop */ }
  if (!id) return NextResponse.json({ error: "id wajib" }, { status: 400 });
  deleteConnection(id);
  return NextResponse.json({ ok: true });
}
