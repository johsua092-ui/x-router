import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dropSession } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = cookies().get("xr_session")?.value;
  if (token) dropSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("xr_session", "", { path: "/", maxAge: 0 });
  return res;
}
