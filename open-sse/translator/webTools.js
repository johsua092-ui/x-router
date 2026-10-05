import { findTagBlocks } from "../utils/tagBlocks.js";
import { parseDsmlToolCalls, hasDsmlToolCalls } from "../utils/dsmlToolCalls.js";

const TOOL_OPEN_RE = /<tool>/g;
const TOOL_CLOSE_RE = /<\/tool>/g;
const TOOL_CALL_OPEN_RE = /<tool_call(?:\s[^<>]*)?>/g;
const TOOL_CALL_CLOSE_RE = /<\/tool_call>/g;

const toolNonceMap = new WeakMap();

export function getToolNonce(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return "";
  let nonce = toolNonceMap.get(tools);
  if (!nonce) {
    nonce = Math.random().toString(36).slice(2, 10);
    toolNonceMap.set(tools, nonce);
  }
  return nonce;
}

function toRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function getRequestedToolNames(tools) {
  if (!Array.isArray(tools)) return [];
  const names = [];
  const seen = new Set();
  for (const tool of tools) {
    const record = toRecord(tool);
    const fn = toRecord(record?.function) || record;
    const name = typeof fn?.name === "string" ? fn.name.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push({ original: name, normalized: normalizeToolName(name) });
  }
  return names;
}

function normalizeToolName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    const temp = previous;
    previous = current;
    current = temp;
  }
  return previous[b.length];
}

function scoreToolName(emitted, requested) {
  if (emitted === requested.original) return 1;
  const normalized = normalizeToolName(emitted);
  if (!normalized || !requested.normalized) return 0;
  if (normalized === requested.normalized) return 0.98;

  const shorter = Math.min(normalized.length, requested.normalized.length);
  const longer = Math.max(normalized.length, requested.normalized.length);
  if (shorter >= 4) {
    if (normalized.includes(requested.normalized) || requested.normalized.includes(normalized)) {
      return 0.86 - (longer - shorter) / Math.max(longer, 1) / 4;
    }
  }

  const distance = levenshteinDistance(normalized, requested.normalized);
  const similarity = 1 - distance / Math.max(longer, 1);
  return similarity >= 0.72 ? similarity : 0;
}

export function resolveRequestedToolName(emitted, requestedTools) {
  if (!requestedTools || requestedTools.length === 0) return emitted;

  let best = null;
  let secondBest = 0;
  for (const requested of requestedTools) {
    const score = scoreToolName(emitted, requested);
    if (!best || score > best.score) {
      secondBest = best?.score ?? 0;
      best = { name: requested.original, score };
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (!best || best.score < 0.72) return null;
  if (best.score < 0.98 && best.score - secondBest < 0.08) return null;
  return best.name;
}

function stripCodeFence(value) {
  return String(value || "")
    .trim()
    .replace(/^```(?:json|javascript|js|python)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function convertSingleQuotedStrings(value) {
  let result = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (const ch of value) {
    if (escaped) {
      result += ch === '"' && inSingle ? '\\"' : ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      if (inSingle) {
        result += '\\"';
      } else {
        inDouble = !inDouble;
        result += ch;
      }
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      result += '"';
      continue;
    }
    result += ch;
  }
  return result;
}

function replacePythonLiterals(value) {
  let result = "";
  let inString = false;
  let escaped = false;
  let token = "";

  const flushToken = () => {
    if (token === "True") result += "true";
    else if (token === "False") result += "false";
    else if (token === "None") result += "null";
    else result += token;
    token = "";
  };

  for (const ch of value) {
    if (escaped) {
      if (token) flushToken();
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (token) flushToken();
      result += ch;
      escaped = inString;
      continue;
    }
    if (ch === '"') {
      if (token) flushToken();
      inString = !inString;
      result += ch;
      continue;
    }
    if (!inString && /[A-Za-z]/.test(ch)) {
      token += ch;
      continue;
    }
    if (token) flushToken();
    result += ch;
  }
  if (token) flushToken();
  return result;
}

function normalizeLooseJson(value) {
  return replacePythonLiterals(convertSingleQuotedStrings(value))
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3')
    .replace(/,\s*([}\]])/g, "$1");
}

export function parseLooseJsonObject(raw) {
  const trimmed = stripCodeFence(raw);
  for (const candidate of [trimmed, normalizeLooseJson(trimmed)]) {
    try {
      return toRecord(JSON.parse(candidate));
    } catch {}
  }
  return null;
}

export function toArgumentsString(value) {
  if (value === undefined) return "{}";
  if (typeof value === "string") {
    const parsed = parseLooseJsonObject(value);
    return parsed ? JSON.stringify(parsed) : value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

export function stripRanges(text, ranges) {
  let content = text;
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  for (const range of sorted) {
    const lineStart = content.lastIndexOf("\n", range.start - 1) + 1;
    const nextLineBreak = content.indexOf("\n", range.end);
    const lineEnd = nextLineBreak === -1 ? content.length : nextLineBreak;
    const beforeOnLine = content.slice(lineStart, range.start);
    const afterOnLine = content.slice(range.end, lineEnd);
    const removeWholeLine = beforeOnLine.trim() === "" && afterOnLine.trim() === "";
    const start = removeWholeLine ? lineStart : range.start;
    const end =
      removeWholeLine && nextLineBreak !== -1
        ? nextLineBreak + 1
        : removeWholeLine
          ? lineEnd
          : range.end;
    content = `${content.slice(0, start)}${content.slice(end)}`;
  }
  return content.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Serialize an OpenAI `tools` array into a system-prompt block that instructs the
 * web UI model how to invoke a tool (emit a `<tool>{...}</tool>` block).
 */
export function serializeToolsToPrompt(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return "";

  const nonce = getToolNonce(tools);
  if (!nonce) return "";

  const lines = [];
  for (const t of tools) {
    const fn = t?.function || t;
    if (!fn?.name) continue;
    const desc = typeof fn.description === "string" && fn.description ? fn.description : "";
    let params = "";
    try {
      params = fn.parameters ? JSON.stringify(fn.parameters) : "";
    } catch {
      params = "";
    }
    lines.push(
      `- ${fn.name}${desc ? `: ${desc}` : ""}${params ? `\n  parameters: ${params}` : ""}`
    );
  }

  if (lines.length === 0) return "";

  return [
    "The client application provides tools beyond your built-in ones. They are NOT in your " +
      "native tool registry; they are invoked via a plain-text protocol: the client parses " +
      "your reply and executes the tool on the user machine. Treat these client tools as " +
      "fully available to you; never claim they are unavailable. To invoke one, reply with " +
      "a single line containing a <tool> block",
    `with JSON that includes the secret binding "_nonce": "${nonce}":`,
    `<tool>{"name": "<tool_name>", "arguments": { ... }, "_nonce": "${nonce}"}</tool>`,
    "These client tools ARE available to you in this conversation. Only emit the <tool> " +
      "block when you actually want to call a tool; otherwise answer normally.",
    "",
    "Available tools:",
    ...lines,
  ].join("\n");
}

/**
 * Parse `<tool>{...}</tool>`, `<tool_call>{...}</tool_call>`, or `<｜DSML｜...>`
 * blocks out of upstream text into OpenAI `tool_calls`.
 */
export function parseToolCallsFromText(text, idSeed = "call", requestedTools) {
  if (typeof text !== "string") {
    return { content: text ?? "", toolCalls: null };
  }

  // Check for DSML tool calls first (DeepSeek / Chinese web models)
  if (hasDsmlToolCalls(text)) {
    const dsmlResult = parseDsmlToolCalls(text);
    if (dsmlResult.toolCalls && dsmlResult.toolCalls.length > 0) {
      return {
        content: dsmlResult.content,
        toolCalls: dsmlResult.toolCalls,
      };
    }
  }

  if (!text.includes("<tool>") && !text.includes("<tool_call")) {
    return { content: text ?? "", toolCalls: null };
  }

  const requestedToolNames = getRequestedToolNames(requestedTools);
  const nonce = getToolNonce(requestedTools);
  const candidates = [];

  for (const block of [
    ...findTagBlocks(text, TOOL_OPEN_RE, TOOL_CLOSE_RE),
    ...findTagBlocks(text, TOOL_CALL_OPEN_RE, TOOL_CALL_CLOSE_RE),
  ]) {
    candidates.push({
      raw: block.inner.trim(),
      start: block.start,
      end: block.end,
      requireRequestedTool: false,
    });
  }

  candidates.sort((a, b) => a.start - b.start);

  const toolCalls = [];
  const acceptedRanges = [];
  for (const candidate of candidates) {
    const parsed = parseLooseJsonObject(candidate.raw);
    const emittedName =
      parsed && typeof parsed.name === "string"
        ? parsed.name
        : parsed && typeof parsed.command === "string"
          ? parsed.command
          : null;
    if (!emittedName) continue;

    if (nonce && parsed && parsed._nonce !== undefined && parsed._nonce !== nonce) continue;

    const name =
      resolveRequestedToolName(emittedName, requestedToolNames) ||
      (candidate.requireRequestedTool ? null : emittedName);
    if (!name || (candidate.requireRequestedTool && requestedToolNames.length === 0)) continue;
    const args = toArgumentsString(parsed?.arguments);
    toolCalls.push({
      id: `${idSeed}_${toolCalls.length}`,
      type: "function",
      function: { name, arguments: args },
    });
    acceptedRanges.push({ start: candidate.start, end: candidate.end });
  }

  if (toolCalls.length === 0) {
    return { content: text, toolCalls: null };
  }

  const content = stripRanges(text, acceptedRanges);
  return { content, toolCalls };
}

function buildToolReminder(toolPrompt) {
  const names = (toolPrompt.match(/^- [^:\n]+/gm) || []).map((s) => s.slice(2).trim()).join(", ");
  return (
    "\n\n[Client protocol reminder: the client-tool contract in the system instructions " +
    "is active in this conversation. These client tools ARE available via the <tool> " +
    "block protocol" +
    (names ? ": " + names : "") +
    ".]"
  );
}

/**
 * Extract tools from an OpenAI request body and inject the tool contract when
 * tools are present.
 */
export function prepareToolMessages(bodyObj, messages) {
  const requestedTools = bodyObj?.tools;
  const hasTools = Array.isArray(requestedTools) && requestedTools.length > 0;
  if (!hasTools) return { hasTools: false, requestedTools, effectiveMessages: messages };

  const toolPrompt = serializeToolsToPrompt(requestedTools);
  if (!toolPrompt) return { hasTools: true, requestedTools, effectiveMessages: messages };

  const effectiveMessages = [...(messages || [])];
  const reminder = buildToolReminder(toolPrompt);
  for (let i = effectiveMessages.length - 1; i >= 0; i--) {
    const msg = effectiveMessages[i];
    if (msg?.role !== "user") continue;
    if (typeof msg.content === "string") {
      effectiveMessages[i] = { ...msg, content: msg.content + reminder };
    } else if (Array.isArray(msg.content)) {
      effectiveMessages[i] = {
        ...msg,
        content: [...msg.content, { type: "text", text: reminder }],
      };
    }
    break;
  }
  effectiveMessages.push({ role: "system", content: toolPrompt });
  return { hasTools: true, requestedTools, effectiveMessages };
}

/**
 * Parse tool calls from a model's text response.
 */
export function buildToolAwareResult(rawContent, requestedTools, idSeed = "call") {
  const { content, toolCalls } = parseToolCallsFromText(
    rawContent,
    `${idSeed}-${Date.now()}`,
    requestedTools
  );
  return {
    content,
    toolCalls,
    finishReason: toolCalls ? "tool_calls" : "stop",
  };
}
