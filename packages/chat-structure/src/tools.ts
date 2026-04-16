/**
 * Agent tool-call registry.
 *
 * Cannibalized from [bcurts/agentchattr](https://github.com/bcurts/agentchattr)
 * `mcp_bridge.py` — same idea (agents call named tools to interact with the
 * chat space) but in-process + typed instead of MCP-bridged. Our tools:
 *
 *   cite_authority  — emit a structured Citation (replaces the fence block)
 *   flag_gap        — flag a gap against a rule
 *   request_review  — hand off to the reviewer persona
 *   hand_off        — transfer lead to another persona (e.g. drafter → risk-assessor)
 *
 * The loop coordinator parses `{{tool:<name>}} ... {{/tool}}` blocks out of a
 * persona's stream and emits them as `tool-call` events the UI renders as
 * typed chips. Tool handlers can be async — e.g. `cite_authority` could
 * cross-check the citation against the cognition store server-side.
 */

import type { ToolCallRecord, ToolName } from "./types.js";

// ---------------------------------------------------------------------------
// Schemas — keep them explicit so the UI + server both know what each tool
// accepts. `unknown` is discouraged on `args` because it means we can't type
// the chip UI, but it's deliberately permissive here so new tools can be
// added without widening this file's type surface.
// ---------------------------------------------------------------------------

export interface CiteAuthorityArgs {
  id: string;          // "c12"
  authorityId: string; // "ni-45-106"
  section: string;     // "2.9(2)(a)"
  quote: string;
  docId: string;
  chunkId: string;
  page?: number;
}

export interface FlagGapArgs {
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  authorityId?: string;
  section?: string;
}

export interface RequestReviewArgs {
  section: string;
  reason: string;
}

export interface HandOffArgs {
  to: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Parser — extract typed tool calls from a persona's output stream.
// Format: {{tool:<name> <json-args>}}
// e.g.   {{tool:flag_gap {"severity":"high","title":"Missing rights of action","description":"..."}}}
// ---------------------------------------------------------------------------

const OPEN = "{{tool:";
const CLOSE = "}}";
const KNOWN_TOOLS: ReadonlySet<ToolName> = new Set([
  "cite_authority",
  "flag_gap",
  "request_review",
  "hand_off",
]);

export interface ParsedToolCallsResult {
  /** The text with tool-call blocks removed. */
  redactedText: string;
  /** Tool calls pulled out of the text, in the order they appeared. */
  toolCalls: ToolCallRecord[];
  /** Tool-lookalike blocks that didn't parse (useful for debugging prompts). */
  unparseable: string[];
}

/**
 * Manual (brace-balanced) parse — the regex-based version broke on nested
 * JSON where `}}` inside `"...}}..."` closed the tool block prematurely.
 *
 * Algorithm: walk the string looking for `{{tool:`. After the name, skip
 * whitespace, then either parse a balanced-brace JSON object or read up
 * to the closing `}}` as a raw arg string (always fails JSON.parse —
 * surfaces as unparseable). Finally require `}}` to close.
 */
export function parseToolCalls(raw: string): ParsedToolCallsResult {
  const toolCalls: ToolCallRecord[] = [];
  const unparseable: string[] = [];
  const consumed: Array<{ start: number; end: number }> = [];
  let id = 0;

  let i = 0;
  while (i < raw.length) {
    const openAt = raw.indexOf(OPEN, i);
    if (openAt === -1) break;
    // Parse tool name
    const j = openAt + OPEN.length;
    let nameEnd = j;
    while (nameEnd < raw.length && /[a-z_]/.test(raw[nameEnd]!)) nameEnd++;
    const toolName = raw.slice(j, nameEnd);

    // Skip whitespace.
    let argStart = nameEnd;
    while (argStart < raw.length && /\s/.test(raw[argStart]!)) argStart++;

    // Parse args: prefer balanced `{ ... }`. If it doesn't start with `{`,
    // read raw to the first `}}`.
    let argStr = "";
    let argEnd = argStart;
    if (raw[argStart] === "{") {
      let depth = 0;
      let inString = false;
      let escape = false;
      let k = argStart;
      for (; k < raw.length; k++) {
        const ch = raw[k];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            argEnd = k + 1;
            break;
          }
        }
      }
      if (depth !== 0) {
        // Unterminated JSON — advance past this open and mark the segment
        // unparseable so we don't get stuck in a loop.
        const fakeEnd = raw.indexOf(CLOSE, openAt + OPEN.length) + CLOSE.length;
        const end = fakeEnd > 0 ? fakeEnd : openAt + OPEN.length + 1;
        unparseable.push(raw.slice(openAt, end));
        consumed.push({ start: openAt, end });
        i = end;
        continue;
      }
      argStr = raw.slice(argStart, argEnd);
    } else {
      // No JSON — take everything up to the first `}}` as a raw arg string.
      const closeAt = raw.indexOf(CLOSE, argStart);
      if (closeAt === -1) break;
      argEnd = closeAt;
      argStr = raw.slice(argStart, argEnd);
    }

    // After args, require `}}` (optionally preceded by whitespace).
    let closeScan = argEnd;
    while (closeScan < raw.length && /\s/.test(raw[closeScan]!)) closeScan++;
    if (raw.slice(closeScan, closeScan + CLOSE.length) !== CLOSE) {
      // Not a valid tool block — advance past the open and continue.
      const nextClose = raw.indexOf(CLOSE, openAt + OPEN.length);
      const end = nextClose === -1 ? raw.length : nextClose + CLOSE.length;
      unparseable.push(raw.slice(openAt, end));
      consumed.push({ start: openAt, end });
      i = end;
      continue;
    }
    const blockEnd = closeScan + CLOSE.length;
    const fullBlock = raw.slice(openAt, blockEnd);

    if (!KNOWN_TOOLS.has(toolName as ToolName)) {
      unparseable.push(fullBlock);
      consumed.push({ start: openAt, end: blockEnd });
      i = blockEnd;
      continue;
    }

    let args: Record<string, unknown> | null = null;
    try {
      args = JSON.parse(argStr) as Record<string, unknown>;
    } catch {
      unparseable.push(fullBlock);
      consumed.push({ start: openAt, end: blockEnd });
      i = blockEnd;
      continue;
    }

    toolCalls.push({
      id: `tc-${id++}`,
      tool: toolName as ToolName,
      args,
    });
    consumed.push({ start: openAt, end: blockEnd });
    i = blockEnd;
  }

  // Build the redacted text by skipping consumed spans.
  let redacted = "";
  let cursor = 0;
  for (const { start, end } of consumed) {
    redacted += raw.slice(cursor, start);
    cursor = end;
  }
  redacted += raw.slice(cursor);
  redacted = redacted.replace(/\n{3,}/g, "\n\n").trim();

  return { redactedText: redacted, toolCalls, unparseable };
}

/**
 * The instruction block a persona system prompt can optionally include to
 * enable tool-call emission. Keeping this in one place means all personas
 * share the same tool surface.
 */
export const TOOL_INSTRUCTION = `
## Agent tools

You may emit structured tool calls using the following syntax:

\`\`\`
{{tool:<name> <json-args>}}
\`\`\`

Available tools:

- **cite_authority** — attach a structured citation to a claim:
  \`{{tool:cite_authority {"id":"c1","authorityId":"ni-45-106","section":"2.9(2)(a)","quote":"…","docId":"...","chunkId":"..."}}}\`
- **flag_gap** — flag a compliance gap:
  \`{{tool:flag_gap {"severity":"high","title":"...","description":"...","authorityId":"...","section":"..."}}}\`
- **request_review** — ask the reviewer persona to look at a section:
  \`{{tool:request_review {"section":"Risk Factors","reason":"..."}}}\`
- **hand_off** — hand the lead to another persona:
  \`{{tool:hand_off {"to":"risk-assessor","reason":"Need exposure analysis on this clause."}}}\`

Emit tool calls alongside your prose. The UI will render them as typed chips. Prefer \`cite_authority\` for citations over the fenced \`\`\`citations JSON block — both work, but the tool call is structured end-to-end.
`.trim();
