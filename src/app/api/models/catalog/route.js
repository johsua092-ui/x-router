import { NextResponse } from "next/server";
import { PROVIDER_MODELS } from "open-sse/config/providerModels.js";
import { getCombos, getCustomModels, getModelAliases } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const modelList = [];
    const seen = new Set();

    // 1. Static provider models
    for (const [provider, models] of Object.entries(PROVIDER_MODELS)) {
      for (const m of models) {
        const id = `${provider}/${m.id}`;
        if (!seen.has(id)) {
          seen.add(id);
          modelList.push({
            id,
            name: m.name || m.id,
            provider,
            category: "provider",
          });
        }
      }
    }

    // 2. Custom studio models
    try {
      const customModels = await getCustomModels();
      for (const c of customModels) {
        const id = c.id;
        if (id && !seen.has(id)) {
          seen.add(id);
          modelList.push({
            id,
            name: c.name || id,
            provider: c.providerAlias || "custom",
            category: "custom",
          });
        }
      }
    } catch {}

    // 3. Combos
    try {
      const combos = await getCombos();
      for (const cb of combos) {
        const id = `combo/${cb.name}`;
        if (!seen.has(id)) {
          seen.add(id);
          modelList.push({
            id,
            name: cb.name,
            provider: "combo",
            category: "combo",
          });
        }
      }
    } catch {}

    return NextResponse.json({ models: modelList, total: modelList.length });
  } catch (error) {
    console.error("Error fetching catalog models:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
