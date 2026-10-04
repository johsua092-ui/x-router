import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionUser, loadRegistry, listConnections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!sessionUser(cookies().get("xr_session")?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const active = new Set(listConnections(undefined, true).map((c) => c.provider));
  const providers = loadRegistry().map((p) => ({
    id: p.id,
    alias: p.alias,
    name: p.name,
    color: p.color || null,
    category: p.category,
    baseUrl: p.baseUrl,
    active: active.has(p.id),
    models: (p.models || []).map((m) => ({ id: m.id, name: m.name, upstream: m.upstream })),
  }));
  return NextResponse.json({ providers });
}
