import { handleChat } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req) {
  return handleChat(req, "openai", "embeddings");
}
