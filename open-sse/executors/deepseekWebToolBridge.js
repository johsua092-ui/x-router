// Universal tool calling bridge for Web Cookie providers (DeepSeek Web, ChatGPT Web, Claude Web, etc.)
// Upgraded with DSML support, <tool> contract with nonce binding, and tolerant argument parsing.

import {
  serializeToolsToPrompt,
  parseToolCallsFromText,
  prepareToolMessages as prepareSharedToolMessages,
} from "../translator/webTools.js";
import { parseDsmlToolCalls, hasDsmlToolCalls } from "../utils/dsmlToolCalls.js";

const TOOL_CALL_MARKER = "<<TOOL_CALL>>";
const TOOL_RESULT_MARKER = "<<TOOL_RESULT>>";

export function hasTools(body) {
  return Array.isArray(body?.tools) && body.tools.length > 0;
}

export function formatToolDefinitions(tools) {
  return serializeToolsToPrompt(tools);
}

export function buildToolSystemPrompt(tools) {
  return serializeToolsToPrompt(tools);
}

export function prepareToolMessages(bodyObj, messages) {
  return prepareSharedToolMessages(bodyObj, messages);
}

// Convert non-text messages (assistant tool_calls, tool results) into readable
// transcript lines the web backend can reason over.
export function renderSpecialMessages(messages) {
  const out = [];
  const callNameById = new Map();

  for (const m of messages || []) {
    if (!m || typeof m !== "object") continue;

    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      const text = extractText(m.content);
      if (text) out.push({ role: "assistant", text });
      for (const tc of m.tool_calls) {
        const fn = tc.function || {};
        const callId = tc.id;
        const name = fn.name || "";
        if (callId && name) callNameById.set(callId, name);

        let args = fn.arguments;
        if (typeof args !== "string") {
          try { args = JSON.stringify(args ?? {}); } catch { args = "{}"; }
        }
        // Emit canonical format
        out.push({
          role: "assistant",
          text: `<tool>{"name":"${name}","arguments":${args || "{}"}}</tool>`,
        });
      }
    } else if (m.role === "tool") {
      const text = extractText(m.content);
      const name = (m.tool_call_id && callNameById.get(m.tool_call_id)) || m.name || "tool";
      out.push({
        role: "tool",
        text: `[Tool Result (${name})]:\n${text}`,
      });
    }
  }
  return out;
}

function extractText(content) {
  if (Array.isArray(content)) {
    return content
      .filter((c) => c?.type === "text" || typeof c?.text === "string")
      .map((c) => String(c.text || ""))
      .join("\n");
  }
  return typeof content === "string" ? content : "";
}

/**
 * Robust tool call parser across multiple dialects:
 * 1. DSML (<｜DSML｜:ToolName>)
 * 2. <tool>{"name": "...", "arguments": {...}}</tool>
 * 3. <tool_call>...</tool_call>
 * 4. Legacy <<TOOL_CALL>>
 */
export function parseToolCallReply(text, requestedTools = null) {
  const raw = String(text || "");

  // 1. Try DSML tool calls
  if (hasDsmlToolCalls(raw)) {
    const dsml = parseDsmlToolCalls(raw);
    if (dsml.toolCalls && dsml.toolCalls.length > 0) {
      const calls = dsml.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: typeof tc.function.arguments === "string"
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments,
      }));
      return { content: dsml.content, calls };
    }
  }

  // 2. Try <tool> and <tool_call> blocks
  if (raw.includes("<tool>") || raw.includes("<tool_call")) {
    const parsed = parseToolCallsFromText(raw, "call", requestedTools);
    if (parsed.toolCalls && parsed.toolCalls.length > 0) {
      const calls = parsed.toolCalls.map((tc) => {
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      });
      return { content: parsed.content, calls };
    }
  }

  // 3. Fallback to <<TOOL_CALL>> marker or code-fenced JSON
  const markerParts = raw.split(TOOL_CALL_MARKER);
  if (markerParts.length >= 3) {
    const calls = [];
    for (let i = 1; i < markerParts.length; i += 2) {
      try {
        const obj = JSON.parse(markerParts[i].trim());
        if (obj && obj.name) {
          calls.push({
            name: obj.name,
            arguments: obj.arguments ?? obj.args ?? {},
          });
        }
      } catch {}
    }
    if (calls.length > 0) {
      const content = markerParts.filter((_, i) => i % 2 === 0).join("").trim();
      return { content, calls };
    }
  }

  return { content: raw, calls: [] };
}

export function generateToolCallId() {
  return `call_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function emitToolCallChunks(chunkFn, ensureRoleFn, calls) {
  if (!calls || calls.length === 0) return false;
  ensureRoleFn();
  calls.forEach((call, index) => {
    const id = call.id || generateToolCallId();
    const args = JSON.stringify(call.arguments ?? {});
    chunkFn({
      tool_calls: [
        {
          index,
          id,
          type: "function",
          function: { name: call.name, arguments: args },
        },
      ],
    });
  });
  chunkFn({}, "tool_calls");
  return true;
}

export function buildToolCallResponse({ id, model, messageText, calls, reasoningContent }) {
  const message = {
    role: "assistant",
    content: messageText || null,
    tool_calls: calls.map((call) => ({
      id: call.id || generateToolCallId(),
      type: "function",
      function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
    })),
  };
  if (reasoningContent) message.reasoning_content = reasoningContent;
  return {
    id: id || `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: "tool_calls" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
