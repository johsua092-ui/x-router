import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "x-router",
    version: "0.2.0",
    engine: "next-node",
  });
}
