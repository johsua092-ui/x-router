export default {
  id: "grok-web",
  priority: 145,
  alias: "grok-web",
  aliases: ["gw", "grok-cookie"],
  uiAlias: "gw",
  display: {
    name: "Grok Web",
    icon: "bolt",
    color: "#EDEDED",
    textIcon: "GW",
    website: "https://grok.com",
    notice: {
      apiKeyUrl: "https://grok.com",
    },
  },
  category: "webCookie",
  authType: "cookie",
  authHint: "Paste your sso / sso-rw cookie from grok.com or x.com",
  transport: {
    baseUrl: "https://grok.com/rest/app-chat",
    format: "openai",
    authType: "cookie",
    auth: { header: "Cookie", scheme: "raw" },
  },
  models: [
    { id: "grok-3", name: "Grok 3 (web)" },
    { id: "grok-3-mini", name: "Grok 3 Mini (web)" },
    { id: "fast", name: "Grok Fast (web)" },
    { id: "expert", name: "Grok Expert Reasoning (web)" },
    { id: "heavy", name: "Grok Heavy Multi-Agent (web)" },
  ],
  passthroughModels: true,
};
