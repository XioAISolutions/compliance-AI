/**
 * Word-level diff that emits the same inline redline tokens the
 * contract-redliner persona uses ([-deleted-], {+inserted+}). Lets the
 * round-N vs round-N+1 comparison reuse RedlinePreview for rendering
 * and the DOCX export path for a "show this to my client" artifact.
 *
 * Algorithm: classic Myers diff via LCS over tokenized word arrays.
 * Tokenization keeps punctuation + whitespace as standalone tokens so
 * the emitted markup preserves paragraph breaks and doesn't stitch
 * words across sentence boundaries.
 *
 * Why not `diff-match-patch` or similar: a pure-in-repo LCS keeps the
 * bundle small, deterministic, and easy to read at review time. The
 * performance profile is fine for the sizes a reviewer output hits
 * (tens of thousands of tokens in the worst case); we short-circuit
 * on equal-prefix / equal-suffix before running the DP matrix.
 */

export interface DiffStats {
  inserted: number;
  deleted: number;
  unchanged: number;
}

export interface DiffResult {
  markup: string;
  stats: DiffStats;
}

const WORD_TOKEN_RE = /[A-Za-z0-9_']+|\s+|[^A-Za-z0-9_'\s]/g;

/** Splits a string into an array of word / whitespace / punctuation tokens. */
export function tokenize(text: string): string[] {
  return text.match(WORD_TOKEN_RE) ?? [];
}

/**
 * Diff two strings at word granularity. Returns the redline markup and
 * per-category counts. `before` is the prior round; `after` is the
 * current round, so deletions are text removed from the prior and
 * insertions are text added in the current.
 */
export function diffOutputs(before: string, after: string): DiffResult {
  if (before === after) {
    return {
      markup: after,
      stats: { inserted: 0, deleted: 0, unchanged: countUnchanged(tokenize(after)) },
    };
  }

  const beforeToks = tokenize(before);
  const afterToks = tokenize(after);

  // Equal-prefix / equal-suffix short circuits keep the LCS matrix
  // small on the common "append a paragraph to the end of a memo"
  // case.
  let prefixLen = 0;
  const maxPrefix = Math.min(beforeToks.length, afterToks.length);
  while (prefixLen < maxPrefix && beforeToks[prefixLen] === afterToks[prefixLen]) {
    prefixLen += 1;
  }
  let suffixLen = 0;
  const beforeTail = beforeToks.length - prefixLen;
  const afterTail = afterToks.length - prefixLen;
  const maxSuffix = Math.min(beforeTail, afterTail);
  while (
    suffixLen < maxSuffix &&
    beforeToks[beforeToks.length - 1 - suffixLen] ===
      afterToks[afterToks.length - 1 - suffixLen]
  ) {
    suffixLen += 1;
  }

  const prefix = beforeToks.slice(0, prefixLen);
  const suffix = beforeToks.slice(beforeToks.length - suffixLen);
  const beforeMid = beforeToks.slice(prefixLen, beforeToks.length - suffixLen);
  const afterMid = afterToks.slice(prefixLen, afterToks.length - suffixLen);

  const midOps = lcsOps(beforeMid, afterMid);

  const parts: string[] = [];
  parts.push(prefix.join(""));

  // Collapse adjacent runs of the same op into single [-…-] or
  // {+…+} markers, matching the syntax the RedlinePreview parser
  // expects. Unchanged runs emit raw text. This keeps the diff
  // readable (one marker per changed span, not one per token).
  let delBuf: string[] = [];
  let insBuf: string[] = [];
  let keepBuf: string[] = [];
  let inserted = 0;
  let deleted = 0;
  let unchanged = countUnchanged(prefix) + countUnchanged(suffix);

  function flushKeep() {
    if (keepBuf.length > 0) {
      parts.push(keepBuf.join(""));
      keepBuf = [];
    }
  }
  function flushDel() {
    if (delBuf.length > 0) {
      parts.push(`[-${delBuf.join("")}-]`);
      delBuf = [];
    }
  }
  function flushIns() {
    if (insBuf.length > 0) {
      parts.push(`{+${insBuf.join("")}+}`);
      insBuf = [];
    }
  }

  for (const op of midOps) {
    switch (op.kind) {
      case "keep":
        flushDel();
        flushIns();
        keepBuf.push(op.token);
        if (isWordToken(op.token)) unchanged += 1;
        break;
      case "delete":
        flushKeep();
        delBuf.push(op.token);
        if (isWordToken(op.token)) deleted += 1;
        break;
      case "insert":
        flushKeep();
        insBuf.push(op.token);
        if (isWordToken(op.token)) inserted += 1;
        break;
    }
  }
  flushDel();
  flushIns();
  flushKeep();

  parts.push(suffix.join(""));

  return {
    markup: parts.join(""),
    stats: { inserted, deleted, unchanged },
  };
}

interface Op {
  kind: "keep" | "insert" | "delete";
  token: string;
}

/**
 * Edit script computed from an LCS over two token arrays. Returns
 * the sequence of keep/insert/delete operations that transforms
 * `before` into `after`.
 *
 * Standard O(M*N) DP; cheap enough for the sizes we're diffing.
 */
function lcsOps(before: readonly string[], after: readonly string[]): Op[] {
  const m = before.length;
  const n = after.length;
  if (m === 0) return after.map((token) => ({ kind: "insert", token }));
  if (n === 0) return before.map((token) => ({ kind: "delete", token }));

  // dp[i][j] = LCS length of before[i..] vs after[j..]; compute in
  // reverse so the traceback runs forward through the token arrays.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (before[i] === after[j]) {
        dp[i]![j] = dp[i + 1]![j + 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (before[i] === after[j]) {
      ops.push({ kind: "keep", token: before[i]! });
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: "delete", token: before[i]! });
      i += 1;
    } else {
      ops.push({ kind: "insert", token: after[j]! });
      j += 1;
    }
  }
  while (i < m) {
    ops.push({ kind: "delete", token: before[i]! });
    i += 1;
  }
  while (j < n) {
    ops.push({ kind: "insert", token: after[j]! });
    j += 1;
  }
  return ops;
}

function isWordToken(t: string): boolean {
  return /[A-Za-z0-9_']/.test(t);
}

function countUnchanged(tokens: readonly string[]): number {
  let n = 0;
  for (const t of tokens) if (isWordToken(t)) n += 1;
  return n;
}
