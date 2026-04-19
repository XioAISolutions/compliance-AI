import { describe, it, expect } from "vitest";
import { inferSourceType } from "../source-type";

describe("inferSourceType", () => {
  it("returns 'other' for empty hints", () => {
    expect(inferSourceType({})).toBe("other");
  });

  it("detects cases by 'v.' pattern", () => {
    expect(inferSourceType({ title: "Smith v. Jones" })).toBe("case");
  });

  it("detects cases by citation year + court abbreviation", () => {
    expect(inferSourceType({ source: "R. v. Jordan, 2016 SCC 27" })).toBe("case");
    expect(inferSourceType({ title: "Heller v. Uber Technologies Inc., 2020 ONCA 1" })).toBe("case");
  });

  it("detects practice directions", () => {
    expect(
      inferSourceType({
        title: "Federal Court Consolidated Notice on AI in Court Proceedings",
      }),
    ).toBe("practice-direction");
    expect(
      inferSourceType({ title: "Ontario Superior Court AI Practice Direction" }),
    ).toBe("practice-direction");
  });

  it("detects regulator notices and staff notices", () => {
    expect(inferSourceType({ title: "OSC Staff Notice 33-316" })).toBe("regulator-notice");
    expect(inferSourceType({ source: "FINTRAC Guideline 6G" })).toBe("regulator-notice");
  });

  it("detects National Instruments and commission rules", () => {
    expect(inferSourceType({ source: "National Instrument 45-106" })).toBe("rule");
    expect(inferSourceType({ title: "NI 31-103 s. 13.3" })).toBe("rule");
  });

  it("detects regulations", () => {
    expect(
      inferSourceType({
        source: "General Regulation, O. Reg. 17/05 under the Consumer Protection Act",
      }),
    ).toBe("regulation");
  });

  it("detects statutes via 'Act' and R.S. citations", () => {
    expect(inferSourceType({ source: "Securities Act, R.S.O. 1990, c. S.5" })).toBe("statute");
    expect(
      inferSourceType({
        source: "Personal Information Protection and Electronic Documents Act",
      }),
    ).toBe("statute");
  });

  it("detects commentary", () => {
    expect(
      inferSourceType({ source: "Law Society of Ontario commentary on generative AI" }),
    ).toBe("commentary");
  });

  it("falls back to 'other' for unrecognized strings", () => {
    expect(inferSourceType({ source: "internal draft memo v3" })).toBe("other");
  });
});
