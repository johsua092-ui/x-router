import { NextResponse } from "next/server";
import { updateSettings } from "@/lib/localDb";
import { isLocalRequest } from "@/dashboardGuard";

// Reset dashboard password to default by clearing the stored hash.
// Local-only. Never returns the default literal.
export async function POST(request) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Password reset is restricted to local terminal CLI only" }, { status: 403 });
    }
    await updateSettings({ password: null });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
