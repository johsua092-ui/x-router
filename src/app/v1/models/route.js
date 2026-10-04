import { NextResponse } from "next/server";
import { denyInvalidKey } from "@/lib/api";
import { registry } from "@/lib/gateway";
import { listConnections } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req) {
  const gate = denyInvalidKey(req);
  if (gate instanceof NextResponse) return gate;

  const active = new Set(listConnections(undefined, true).map((c) => c.provider));
  const data = [];
  for (const p of registry()) {
    if (!active.has(p.id)) continue;
    for (const m of p.models || []) {
      data.push({
        id: m.id,
        object: "model",
        created: 0,
        owned_by: p.alias || p.id,
      });
    }
  }
  data.sort((a, b) => a.id.localeCompare(b.id));
  return NextResponse.json({ object: "list", data });
}
