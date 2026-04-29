/**
 * CRUMB → lesson candidate parser.
 *
 * The web layer emits CRUMB blocks at matter-handoff time (see
 * apps/web/src/lib/matter-context.ts → renderCrumbHandoff). This
 * module converts a CRUMB block into one or more lesson candidates
 * the sidecar can consolidate. We deliberately keep the parser
 * tolerant — CRUMB is YAML-ish and may grow over time; we extract
 * what we recognize and ignore the rest.
 *
 * Recognized patterns (per crumb-version: 1.x):
 *   - lessons:                       a top-level list of strings or
 *                                     objects with at least `content`.
 *   - matter.title / matter.taskType — used as default tags.
 *   - findings.observed-gaps         — promoted to lesson candidates
 *                                     when no explicit lessons block.
 *   - matter.id / crumb-version      — propagated as source metadata.
 *
 * Output is a list of LessonCandidate suitable for sidecar
 * consolidation. The caller is expected to set sessionId — the
 * parser cannot infer session boundaries from the block alone.
 */

import type { LessonCandidate, LessonSource } from "./types.js";

const CRUMB_LESSON_KEYS = ["lessons", "observed-gaps", "lessons-learned"];

export interface ParseCrumbOptions {
  organizationId: string;
  sessionId: string;
  defaultAgent?: string;
  /** Default observation timestamp; falls back to now. */
  observedAt?: Date;
}

/**
 * Parse a CRUMB block (the YAML-ish text emitted by
 * renderCrumbHandoff) into lesson candidates. Forgives malformed
 * sections — anything we can't parse is silently skipped.
 */
export function parseCrumbToCandidates(
  crumbText: string,
  opts: ParseCrumbOptions,
): LessonCandidate[] {
  const lines = crumbText.replace(/\r\n/g, "\n").split("\n");
  const meta = extractTopLevelScalars(lines);
  const lessonsBlock = extractListBlock(lines, CRUMB_LESSON_KEYS);
  if (lessonsBlock.length === 0) return [];

  const tags: string[] = [];
  if (meta["matter.taskType"]) tags.push(meta["matter.taskType"]);
  if (meta["matter.id"]) tags.push(`matter:${meta["matter.id"]}`);

  const observedAt = opts.observedAt ?? new Date();
  const source: LessonSource = {
    sessionId: opts.sessionId,
    observedAt,
    ...(opts.defaultAgent !== undefined ? { agent: opts.defaultAgent } : {}),
    ...(meta["matter.id"] !== undefined ? { crumbId: meta["matter.id"] } : {}),
  };

  return lessonsBlock.map((entry) => ({
    organizationId: opts.organizationId,
    content: entry,
    source: { ...source, excerpt: entry.slice(0, 240) },
    tags: [...tags],
    ...(meta["matter.jurisdiction"] !== undefined
      ? { jurisdiction: meta["matter.jurisdiction"] }
      : {}),
  }));
}

/** Pull simple `key: value` and `key.path: value` scalars from the top of the block. */
function extractTopLevelScalars(lines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  // Track nested context so `matter:\n  title: foo` is captured as
  // matter.title=foo. Cheap path-prefix join, indent-aware.
  const stack: { indent: number; key: string }[] = [];
  for (const raw of lines) {
    if (raw.trim().length === 0) continue;
    if (raw.trimStart().startsWith("- ")) continue; // list element
    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    const m = trimmed.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!m) continue;
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) stack.pop();
    const path = [...stack.map((s) => s.key), m[1]!].join(".");
    if (m[2] && m[2].length > 0) {
      out[path] = stripQuotes(m[2]);
    } else {
      stack.push({ indent, key: m[1]! });
    }
  }
  return out;
}

/** Pull list items from the first matching block key. */
function extractListBlock(lines: string[], keys: string[]): string[] {
  for (const key of keys) {
    const startIdx = lines.findIndex((l) => l.trim() === `${key}:`);
    if (startIdx < 0) continue;
    const baseIndent = lines[startIdx]!.length - lines[startIdx]!.trimStart().length;
    const out: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const raw = lines[i]!;
      if (raw.trim().length === 0) continue;
      const indent = raw.length - raw.trimStart().length;
      if (indent <= baseIndent) break;
      const trimmed = raw.trim();
      if (trimmed.startsWith("- ")) {
        const value = trimmed.slice(2).trim();
        if (value.length > 0) out.push(stripQuotes(value));
      }
    }
    if (out.length > 0) return out;
  }
  return [];
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}
