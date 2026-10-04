import { handleChat } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req) {
  return handleChat(req, "anthropic", "chat");
}
