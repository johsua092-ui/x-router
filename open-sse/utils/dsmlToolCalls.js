import crypto from "node:crypto";

const FW = "[｜|]";
const DSML_OPEN_RE = new RegExp(`<${FW}DSML${FW}:(\\w+)([^>]*)>`, "i");

function dsmlCloseRe(name) {
  return new RegExp(`</${FW}DSML${FW}:${name}\\s*>`, "i");
}

const DSML_CHILD_NAME_ONLY_RE = /<(\w+)>([\s\S]*?)<\/\1>/g;
const DSML_CHILD_NAMED_RE = /<parameter\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/parameter>/gi;

const STRAY_CLOSE_SRC =
  `</${FW}DSML${FW}(?:tool_calls|invoke|parameter)\\s*>\\n*` + `|</(?:parameter|invoke)>\\n*`;
const DSML_STRAY_CLOSE_RE = new RegExp(STRAY_CLOSE_SRC, "gi");
const DSML_PARTIAL_OPEN_RE = new RegExp(`(<${FW}DSML${FW}[^<]*)$`, "i");

export function parseDsmlToolCalls(text) {
  if (!text || typeof text !== "string") {
    return { content: text || "", toolCalls: [], holdback: "" };
  }

  let remaining = text;
  const toolCalls = [];
  let cleaned = "";

  while (remaining.length > 0) {
    const openMatch = remaining.match(DSML_OPEN_RE);
    if (!openMatch || openMatch.index === undefined) {
      let tail = remaining.replace(DSML_STRAY_CLOSE_RE, "");
      const partial = tail.match(DSML_PARTIAL_OPEN_RE);
      let holdback = "";
      if (partial) {
        tail = tail.slice(0, partial.index);
        holdback = partial[1];
      }
      cleaned += tail;
      return { content: cleaned, toolCalls, holdback };
    }

    const before = remaining.slice(0, openMatch.index).replace(DSML_STRAY_CLOSE_RE, "");
    cleaned += before;

    const toolName = openMatch[1];
    const afterOpen = remaining.slice(openMatch.index + openMatch[0].length);
    const closeRe = dsmlCloseRe(toolName);
    const closeMatch = afterOpen.match(closeRe);
    if (!closeMatch) {
      return { content: cleaned, toolCalls, holdback: openMatch[0] + afterOpen };
    }

    const inner = afterOpen.slice(0, closeMatch.index);
    const args = parseDsmlArgs(inner);
    toolCalls.push({
      id: `call_dsml_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
      type: "function",
      function: { name: toolName, arguments: JSON.stringify(args) },
    });

    remaining = afterOpen.slice(closeMatch.index + closeMatch[0].length);
  }

  return { content: cleaned, toolCalls, holdback: "" };
}

function parseDsmlArgs(inner) {
  const args = {};
  const namedRe = new RegExp(DSML_CHILD_NAMED_RE);
  let m;
  const consumed = new Set();
  while ((m = namedRe.exec(inner)) !== null) {
    args[m[1]] = m[2].trim();
    consumed.add(m[0]);
  }
  const bareRe = new RegExp(DSML_CHILD_NAME_ONLY_RE);
  while ((m = bareRe.exec(inner)) !== null) {
    if (consumed.has(m[0])) continue;
    let nested = false;
    for (const c of consumed) {
      if (c.includes(m[0]) && c !== m[0]) {
        nested = true;
        break;
      }
    }
    if (nested) continue;
    args[m[1]] = m[2].trim();
    consumed.add(m[0]);
  }
  return args;
}

export function hasDsmlToolCalls(text) {
  if (!text || typeof text !== "string") return false;
  return /[/]?[｜|]DSML[｜|]/.test(text);
}
