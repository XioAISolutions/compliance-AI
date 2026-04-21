import { describe, it, expect } from "vitest";
import { looksLikeRedline } from "../RedlinePreview";

/**
 * Heuristic detection — the matter page auto-picks the redline
 * renderer over the markdown renderer when output carries any of the
 * three diff tokens. False-positive risk is low because the tokens are
 * deliberately distinctive (no markdown collision).
 */
describe("looksLikeRedline", () => {
  it("returns true on a deletion token", () => {
    expect(looksLikeRedline("Notice within [-ten (10)-] days.")).toBe(true);
  });

  it("returns true on an insertion token", () => {
    expect(looksLikeRedline("Notice within {+thirty (30)+} days.")).toBe(true);
  });

  it("returns true on a NOTE token", () => {
    expect(
      looksLikeRedline("The forum is Ontario. <<NOTE: Delaware was rejected.>>"),
    ).toBe(true);
  });

  it("returns true on a multi-line insertion (new clause)", () => {
    const input =
      "{+Section 7A — PIPEDA Compliance.\nThe Processor shall process Personal Information\nonly on documented instructions.+}";
    expect(looksLikeRedline(input)).toBe(true);
  });

  it("returns false on plain markdown prose with citations", () => {
    expect(
      looksLikeRedline(
        "## Required Disclosures\n\n| # | Requirement | Status |\n|---|---|---|\n| 1 | Risk factors [c1] | FOUND |",
      ),
    ).toBe(false);
  });

  it("returns false on prose that happens to use square brackets but not the redline pattern", () => {
    expect(
      looksLikeRedline("See [Section 3] of the agreement and the citation [c1]."),
    ).toBe(false);
  });

  it("returns false on prose that uses curly braces without the + token", () => {
    expect(looksLikeRedline("Configure { foo: 1 } as the example.")).toBe(false);
  });

  it("returns false on the string 'NOTE' without the << >> wrapper", () => {
    expect(looksLikeRedline("NOTE: this is just a heading.")).toBe(false);
  });

  it("returns true even when only one token appears in a long document", () => {
    const long = "A".repeat(5000) + " [-old text-] " + "B".repeat(5000);
    expect(looksLikeRedline(long)).toBe(true);
  });
});
