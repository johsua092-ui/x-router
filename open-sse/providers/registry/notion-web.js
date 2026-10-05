export default {
  id: "notion-web",
  priority: 150,
  alias: "notion-web",
  aliases: ["notion-cookie"],
  uiAlias: "notionw",
  display: {
    name: "Notion AI Web",
    icon: "bolt",
    color: "#000000",
    textIcon: "NW",
    website: "https://www.notion.so",
    notice: {
      apiKeyUrl: "https://www.notion.so",
    },
  },
  category: "webCookie",
  authType: "cookie",
  authHint: "Paste your token_v2 cookie from notion.so (DevTools -> Application -> Cookies)",
  transport: {
    baseUrl: "https://www.notion.so/api/v3",
    format: "openai",
    authType: "cookie",
    auth: { header: "Cookie", scheme: "raw" },
  },
  models: [
    { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet (via Notion AI)" },
    { id: "gpt-4o", name: "GPT-4o (via Notion AI)" },
  ],
  passthroughModels: true,
};
