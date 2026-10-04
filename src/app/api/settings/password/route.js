import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionUser, setPassword } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!sessionUser(cookies().get("xr_session")?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let pw = "";
  try {
    ({ password: pw } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!pw || String(pw).length < 6) {
    return NextResponse.json({ error: "minimal 6 karakter" }, { status: 400 });
  }
  setPassword(String(pw));
  const res = NextResponse.json({ ok: true });
  res.cookies.set("xr_session", "", { path: "/", maxAge: 0 });
  return res;
}
