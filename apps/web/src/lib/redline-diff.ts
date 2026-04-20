/**
 * Redline diff parser — converts the contract-redliner persona's inline
 * diff-token output into a structured segment list the DOCX renderer
 * can emit as styled runs.
 *
 * Token syntax:
 *   [-old text-]        — deletion (rendered strikethrough + red)
 *   {+new text+}        — insertion (rendered underline + blue)
 *   <<NOTE: reason>>    — rationale (rendered as a footnote)
 *   plain text          — unchanged
 *
 * The parser is intentionally forgiving: malformed tokens fall through
 * as plain text rather than throwing, so an over-enthusiastic model
 * emitting a stray `{+` doesn't break the entire export.
 */

export type RedlineSegment =
  | { kind: "text"; content: string }
  | { kind: "delete"; content: string }
  | { kind: "insert"; content: string }
  | { kind: "note"; content: string };

/** Counts per segment kind — surfaced in the DOCX header summary. */
export interface RedlineStats {
  insertions: number;
  deletions: number;
  notes: number;
  /** Character count of the unchanged text body. */
  unchangedChars: number;
}

/**
 * Greedy left-to-right tokenizer. Uses a regex with three alternations
 * (delete / insert / note) and emits text segments for the gaps between
 * matches. Multi-line tokens are supported — [s\s] in the capture makes
 * `.` cross newlines.
 */
const TOKEN_RE =
  /\[-([\s\S]*?)-\]|\{\+([\s\S]*?)\+\}|<<NOTE:\s*([\s\S]*?)>>/g;

export function parseRedline(raw: string): RedlineSegment[] {
  const segments: RedlineSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "text", content: raw.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ kind: "delete", content: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ kind: "insert", content: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ kind: "note", content: match[3].trim() });
    }
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (lastIndex < raw.length) {
    segments.push({ kind: "text", content: raw.slice(lastIndex) });
  }
  return segments;
}

export function redlineStats(segments: readonly RedlineSegment[]): RedlineStats {
  const s: RedlineStats = {
    insertions: 0,
    deletions: 0,
    notes: 0,
    unchangedChars: 0,
  };
  for (const seg of segments) {
    switch (seg.kind) {
      case "insert":
        s.insertions += 1;
        break;
      case "delete":
        s.deletions += 1;
        break;
      case "note":
        s.notes += 1;
        break;
      case "text":
        s.unchangedChars += seg.content.length;
        break;
    }
  }
  return s;
}

/**
 * Strip redline tokens and keep only the final (post-redline) text:
 * insertions are kept, deletions + notes are removed. Useful for the
 * hard-signoff export gate, which hashes the output the user intends to
 * file — and the thing the user files is the post-redline text, not the
 * diff markup.
 */
export function redlineToFinalText(raw: string): string {
  const segments = parseRedline(raw);
  return segments
    .filter((s) => s.kind === "text" || s.kind === "insert")
    .map((s) => s.content)
    .join("");
}

/**
 * Round-trip: parse and re-emit in the original token syntax. Primarily
 * a test helper but also useful for the export route to sanity-check
 * that the parser isn't losing content.
 */
export function redlineToMarkup(segments: readonly RedlineSegment[]): string {
  const out: string[] = [];
  for (const seg of segments) {
    switch (seg.kind) {
      case "text":
        out.push(seg.content);
        break;
      case "delete":
        out.push(`[-${seg.content}-]`);
        break;
      case "insert":
        out.push(`{+${seg.content}+}`);
        break;
      case "note":
        out.push(`<<NOTE: ${seg.content}>>`);
        break;
    }
  }
  return out.join("");
}
