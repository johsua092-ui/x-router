export default {
  id: "duckduckgo-web",
  priority: 149,
  alias: "duckduckgo-web",
  aliases: ["ddgw", "duckchat"],
  uiAlias: "ddgw",
  display: {
    name: "DuckDuckGo AI Web",
    icon: "bolt",
    color: "#DE5833",
    textIcon: "DDG",
    website: "https://duckduckgo.com/duckchat",
    notice: {
      apiKeyUrl: "https://duckduckgo.com/duckchat",
    },
  },
  category: "webCookie",
  authType: "cookie",
  authHint: "Paste your x-vqd-4 header or session cookie from duckduckgo.com/duckchat (Optional, can run anonymous)",
  transport: {
    baseUrl: "https://duckduckgo.com/duckchat/v1",
    format: "openai",
    authType: "cookie",
    auth: { header: "Cookie", scheme: "raw" },
  },
  models: [
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku (via DuckChat)" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini (via DuckChat)" },
    { id: "o3-mini", name: "o3-mini (via DuckChat)" },
    { id: "meta-llama/Llama-3.3-70B-Instruct", name: "Llama 3.3 70B (via DuckChat)" },
    { id: "mistralai/Mistral-Small-24B-Instruct-2501", name: "Mistral Small 24B (via DuckChat)" },
  ],
  passthroughModels: true,
};
