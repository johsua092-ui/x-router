import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  sessionUser, stats, usageDaily, topModels, providerBreakdown,
  latencyStats, lastHourRequests, loadRegistry, listConnections,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!sessionUser(cookies().get("xr_session")?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const s = stats();
  return NextResponse.json({
    keys: s.keys,
    connections: s.connections,
    requests: s.requests,
    ok: s.ok,
    tokens: s.tokens,
    daily: usageDaily(14),
    topModels: topModels(10),
    providers: providerBreakdown(12),
    latency: latencyStats(),
    lastHour: lastHourRequests(),
    catalog: {
      providers: loadRegistry().length,
      models: loadRegistry().reduce((n, p) => n + (p.models?.length || 0), 0),
      activeProviders: listConnections(undefined, true).length,
    },
    recent: s.recent.slice(0, 40),
  });
}
