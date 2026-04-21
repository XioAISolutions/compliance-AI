import { describe, it, expect } from "vitest";
import { diffOutputs, tokenize } from "../output-diff";

describe("tokenize", () => {
  it("splits into word / whitespace / punctuation tokens", () => {
    expect(tokenize("Hello, world!")).toEqual(["Hello", ",", " ", "world", "!"]);
  });
  it("preserves apostrophes + underscores inside word tokens", () => {
    expect(tokenize("it's good_day")).toEqual(["it's", " ", "good_day"]);
  });
});

describe("diffOutputs", () => {
  it("returns unchanged text when before === after", () => {
    const text = "No changes here.";
    const r = diffOutputs(text, text);
    expect(r.markup).toBe(text);
    expect(r.stats).toEqual({ inserted: 0, deleted: 0, unchanged: 3 });
  });

  it("emits {+inserted+} for a pure append", () => {
    const r = diffOutputs("Hello world.", "Hello world. Extra sentence.");
    expect(r.markup).toContain("Hello world.");
    expect(r.markup).toContain("{+");
    expect(r.markup).toMatch(/\{\+.*Extra sentence.*\+\}/);
    expect(r.stats.inserted).toBeGreaterThan(0);
    expect(r.stats.deleted).toBe(0);
  });

  it("emits [-deleted-] for a pure removal", () => {
    const r = diffOutputs("The quick brown fox.", "The fox.");
    expect(r.markup).toMatch(/\[-.*quick.*brown.*-\]/);
    expect(r.stats.inserted).toBe(0);
    expect(r.stats.deleted).toBeGreaterThan(0);
  });

  it("substitutes produce paired delete+insert markers", () => {
    const r = diffOutputs("Within ten days.", "Within thirty days.");
    expect(r.markup).toContain("[-ten-]");
    expect(r.markup).toContain("{+thirty+}");
    expect(r.stats.inserted).toBe(1);
    expect(r.stats.deleted).toBe(1);
  });

  it("collapses adjacent same-op tokens into a single marker", () => {
    const r = diffOutputs(
      "The Licensee shall provide notice.",
      "The Licensor shall deliver notice.",
    );
    // Two separate substitutions → two marker pairs.
    const insertMatches = r.markup.match(/\{\+[\s\S]+?\+\}/g) ?? [];
    const deleteMatches = r.markup.match(/\[-[\s\S]+?-\]/g) ?? [];
    expect(insertMatches).toHaveLength(2);
    expect(deleteMatches).toHaveLength(2);
  });

  it("short-circuits equal prefix + suffix (doesn't mark them as changed)", () => {
    const prefix = "Shared opening sentence. ";
    const suffix = " Shared closing sentence.";
    const before = `${prefix}old middle${suffix}`;
    const after = `${prefix}new middle${suffix}`;
    const r = diffOutputs(before, after);
    // The shared bookends should appear verbatim, not wrapped in
    // deletion/insertion markers.
    expect(r.markup.startsWith(prefix)).toBe(true);
    expect(r.markup.endsWith(suffix)).toBe(true);
    expect(r.markup).toContain("[-old-]");
    expect(r.markup).toContain("{+new+}");
  });

  it("produces markup RedlinePreview can parse (balanced tokens)", () => {
    const r = diffOutputs("original", "completely different");
    const openDel = (r.markup.match(/\[-/g) ?? []).length;
    const closeDel = (r.markup.match(/-\]/g) ?? []).length;
    const openIns = (r.markup.match(/\{\+/g) ?? []).length;
    const closeIns = (r.markup.match(/\+\}/g) ?? []).length;
    expect(openDel).toBe(closeDel);
    expect(openIns).toBe(closeIns);
  });

  it("handles empty strings on either side", () => {
    expect(diffOutputs("", "new content").stats.inserted).toBeGreaterThan(0);
    expect(diffOutputs("old content", "").stats.deleted).toBeGreaterThan(0);
    expect(diffOutputs("", "").stats).toEqual({ inserted: 0, deleted: 0, unchanged: 0 });
  });
});
