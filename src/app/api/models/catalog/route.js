import { NextResponse } from "next/server";
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { getProviderAlias, isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { getProviderConnections, getCombos, getCustomModels, getStudioModels, getProviderNodes } from "@/lib/localDb";

export const dynamic = "force-dynamic";

/**
 * GET /api/models/catalog
 * Auto-detects ONLY models from providers that are ACTUALLY installed/connected
 * in X Router (plus custom models, combos, and active provider nodes).
 * If a provider has not been configured/connected, its models are NOT returned.
 */
export async function GET() {
  try {
    const installedModels = [];
    const seen = new Set();

    // 1. Fetch active provider connections from X Router DB
    let connections = [];
    try {
      connections = (await getProviderConnections()) || [];
      connections = connections.filter((c) => c.isActive !== false);
    } catch {
      connections = [];
    }

    // 2. Map models for each connected provider
    const activeProviderMap = new Map();
    for (const conn of connections) {
      if (!activeProviderMap.has(conn.provider)) {
        activeProviderMap.set(conn.provider, conn);
      }
    }

    for (const [providerId, conn] of activeProviderMap.entries()) {
      const staticAlias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
      const outputAlias = (
        conn?.providerSpecificData?.prefix ||
        getProviderAlias(providerId) ||
        staticAlias
      ).trim();

      const providerModels = PROVIDER_MODELS[staticAlias] || PROVIDER_MODELS[providerId] || [];
      const enabledModels = conn?.providerSpecificData?.enabledModels;
      const hasExplicitEnabledModels = Array.isArray(enabledModels) && enabledModels.length > 0;

      let modelList = hasExplicitEnabledModels ? enabledModels : providerModels;

      for (const item of modelList) {
        const rawId = typeof item === "string" ? item : item.id;
        const name = typeof item === "string" ? item : item.name || item.id;
        if (!rawId) continue;

        // Strip prefix if already present in ID
        let cleanId = rawId;
        if (cleanId.startsWith(`${outputAlias}/`)) {
          cleanId = cleanId.slice(outputAlias.length + 1);
        } else if (cleanId.startsWith(`${staticAlias}/`)) {
          cleanId = cleanId.slice(staticAlias.length + 1);
        } else if (cleanId.startsWith(`${providerId}/`)) {
          cleanId = cleanId.slice(providerId.length + 1);
        }

        const fullId = `${outputAlias}/${cleanId}`;
        if (!seen.has(fullId)) {
          seen.add(fullId);
          installedModels.push({
            id: fullId,
            name: `${outputAlias}: ${name}`,
            provider: providerId,
            alias: outputAlias,
            category: "installed-provider",
          });
        }
      }
    }

    // 3. Include active Provider Nodes (Custom OpenAI/Anthropic Compatible upstreams)
    try {
      const nodes = (await getProviderNodes()) || [];
      for (const node of nodes) {
        if (node.isActive === false) continue;
        const prefix = node.data?.prefix || node.name || "node";
        const models = node.data?.models || [];
        for (const m of models) {
          const modelId = typeof m === "string" ? m : m.id;
          if (!modelId) continue;
          const fullId = `${prefix}/${modelId}`;
          if (!seen.has(fullId)) {
            seen.add(fullId);
            installedModels.push({
              id: fullId,
              name: `${prefix}: ${modelId}`,
              provider: "node",
              alias: prefix,
              category: "provider-node",
            });
          }
        }
      }
    } catch {}

    // 4. Include user-created Combos
    try {
      const combos = (await getCombos()) || [];
      for (const cb of combos) {
        const id = cb.name;
        if (id && !seen.has(id)) {
          seen.add(id);
          installedModels.push({
            id,
            name: `Combo: ${cb.name}`,
            provider: "combo",
            alias: "combo",
            category: "combo",
          });
        }
      }
    } catch {}

    // 5. Include user-configured Studio / Custom Models
    try {
      const studioModels = (await getStudioModels()) || [];
      for (const s of studioModels) {
        const id = s.callName || s.id;
        if (id && !seen.has(id)) {
          seen.add(id);
          installedModels.push({
            id,
            name: `Custom: ${s.displayName || id}`,
            provider: s.provider || "custom",
            alias: "custom",
            category: "custom-model",
          });
        }
      }
    } catch {}

    try {
      const customModels = (await getCustomModels()) || [];
      for (const c of customModels) {
        const id = c.id;
        if (id && !seen.has(id)) {
          seen.add(id);
          installedModels.push({
            id,
            name: `Custom: ${c.name || id}`,
            provider: c.providerAlias || "custom",
            alias: "custom",
            category: "custom-model",
          });
        }
      }
    } catch {}

    return NextResponse.json({
      models: installedModels,
      total: installedModels.length,
      hasInstalledProviders: installedModels.length > 0,
    });
  } catch (error) {
    console.error("Error fetching installed catalog models:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
