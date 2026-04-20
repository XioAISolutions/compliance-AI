import { describe, it, expect } from "vitest";
import {
  parseRedline,
  redlineStats,
  redlineToFinalText,
  redlineToMarkup,
} from "../redline-diff";

describe("parseRedline", () => {
  it("returns a single text segment for plain prose", () => {
    const segs = parseRedline("The Licensee shall provide notice.");
    expect(segs).toHaveLength(1);
    expect(segs[0]!.kind).toBe("text");
  });

  it("tokenizes a deletion + insertion + note in order", () => {
    const input =
      "Notice within [-ten (10)-]{+thirty (30)+} days. <<NOTE: Ontario market norm.>>";
    const segs = parseRedline(input);
    const kinds = segs.map((s) => s.kind);
    expect(kinds).toEqual(["text", "delete", "insert", "text", "note"]);
    expect((segs[1] as { content: string }).content).toBe("ten (10)");
    expect((segs[2] as { content: string }).content).toBe("thirty (30)");
    expect((segs[4] as { content: string }).content).toBe("Ontario market norm.");
  });

  it("handles multiple tokens per paragraph", () => {
    const input =
      "The [-Licensee-]{+Licensor+} shall indemnify the [-Licensor-]{+Licensee+}.";
    const stats = redlineStats(parseRedline(input));
    expect(stats.deletions).toBe(2);
    expect(stats.insertions).toBe(2);
  });

  it("supports multi-line insertions (adding a new clause)", () => {
    const input =
      "{+Section 7A — PIPEDA Compliance.\nThe Processor shall process Personal Information only on documented instructions.+} <<NOTE: Required under PIPEDA Schedule 1.>>";
    const segs = parseRedline(input);
    expect(segs.find((s) => s.kind === "insert")).toBeDefined();
    expect((segs.find((s) => s.kind === "insert") as { content: string }).content).toContain(
      "PIPEDA Compliance",
    );
  });

  it("falls through to plain text on malformed tokens", () => {
    // A stray `{+` with no closing `+}` should NOT throw.
    const input = "Malformed {+ no close at all and some [-this closes-] cleanly.";
    const segs = parseRedline(input);
    expect(segs.find((s) => s.kind === "delete")).toBeDefined();
    // The malformed insertion stays in the text stream.
    expect(segs.some((s) => s.kind === "text" && s.content.includes("{+"))).toBe(true);
  });

  it("is idempotent under parse → markup round-trip", () => {
    const input =
      "Notice within [-ten-]{+thirty+} days. <<NOTE: market norm.>> Also, [-Delaware-]{+Ontario+} governs.";
    const segs = parseRedline(input);
    const round = redlineToMarkup(segs);
    expect(round).toBe(input);
  });
});

describe("redlineStats", () => {
  it("counts insertions, deletions, notes, and unchanged characters", () => {
    const input =
      "Hello [-world-]{+friend+} and <<NOTE: casual greeting>> beyond [-this-]{+that+}.";
    const stats = redlineStats(parseRedline(input));
    expect(stats.insertions).toBe(2);
    expect(stats.deletions).toBe(2);
    expect(stats.notes).toBe(1);
    expect(stats.unchangedChars).toBeGreaterThan(0);
  });

  it("reports zeros for plain prose with no tokens", () => {
    const stats = redlineStats(parseRedline("Plain contract text with no changes."));
    expect(stats.insertions).toBe(0);
    expect(stats.deletions).toBe(0);
    expect(stats.notes).toBe(0);
    expect(stats.unchangedChars).toBe("Plain contract text with no changes.".length);
  });
});

describe("redlineToFinalText", () => {
  it("keeps insertions, drops deletions + notes", () => {
    const input =
      "Notice within [-ten-]{+thirty+} days <<NOTE: see memo>>. Always [-immediately-]{+promptly+}.";
    expect(redlineToFinalText(input)).toBe(
      "Notice within thirty days . Always promptly.",
    );
  });

  it("matches the original on token-free input", () => {
    const text = "No changes here.";
    expect(redlineToFinalText(text)).toBe(text);
  });

  it("drops notes even when they appear alone", () => {
    expect(redlineToFinalText("Plain <<NOTE: aside>> prose.")).toBe("Plain  prose.");
  });
});
