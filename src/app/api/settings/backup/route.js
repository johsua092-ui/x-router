import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionUser, db } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!sessionUser(cookies().get("xr_session")?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const dir = path.join(process.cwd(), "data", "backups");
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(dir, `xrouter-${stamp}.db`);
    // VACUUM INTO = snapshot konsisten walau ada tulisan concurrent
    db().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);

    // rotasi: sisakan 10 terbaru
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith("xrouter-") && f.endsWith(".db"))
      .sort();
    for (const old of files.slice(0, Math.max(0, files.length - 10))) {
      fs.unlinkSync(path.join(dir, old));
    }
    return NextResponse.json({ ok: true, file: path.relative(process.cwd(), file) });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
