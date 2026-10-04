import { NextResponse } from "next/server";
import { verifyPw, createSession, adminId, SESSION_TTL } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let pw = "";
  try {
    ({ password: pw } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!pw || !verifyPw("admin", pw)) {
    return NextResponse.json({ error: "Password salah." }, { status: 401 });
  }
  const tok = createSession(adminId());
  const res = NextResponse.json({ ok: true });
  res.cookies.set("xr_session", tok, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return res;
}
