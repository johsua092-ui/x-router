import { NextResponse } from "next/server";

// Auth gate awal: cegah shell ter-render sebelum redirect.
// Validasi sesi sesungguhnya tetap di (dashboard)/layout.js (node:sqlite).
const PROTECTED = ["/dashboard", "/providers", "/models", "/usage", "/logs", "/settings"];

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get("xr_session")?.value);

  // di balik nginx/Cloudflare: pakai origin asli, jangan host internal
  const origin =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
      ? "https"
      : req.nextUrl.protocol === "https:"
      ? "https"
      : "http";
  const host =
    (req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host)
      .split(",")[0]
      .trim();

  if (PROTECTED.includes(pathname) && !hasSession) {
    return NextResponse.redirect(`${origin}://${host}/login`);
  }

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(`${origin}://${host}/dashboard`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/providers", "/models", "/usage", "/logs", "/settings", "/login"],
};
