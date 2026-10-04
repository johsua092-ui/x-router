import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionUser, clearLogs } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!sessionUser(cookies().get("xr_session")?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const deleted = clearLogs();
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
