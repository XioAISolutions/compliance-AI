import { describe, it, expect } from "vitest";
import { parseCrumbToCandidates } from "../crumb.js";

describe("parseCrumbToCandidates", () => {
  it("extracts a top-level lessons list and propagates jurisdiction tags", () => {
    const crumb = `
crumb-version: 1.2
matter:
  id: matter-123
  title: Northstar Fund II OM
  taskType: om-review
  jurisdiction: ontario
lessons:
  - "Always verify NI 33-109 disclosure for Ontario EMD distributions."
  - "Form 45-106F1 must accompany every accredited-investor distribution."
`;
    const out = parseCrumbToCandidates(crumb, {
      organizationId: "org-1",
      sessionId: "sess-1",
      defaultAgent: "judge",
    });
    expect(out).toHaveLength(2);
    expect(out[0]!.organizationId).toBe("org-1");
    expect(out[0]!.tags).toContain("om-review");
    expect(out[0]!.tags).toContain("matter:matter-123");
    expect(out[0]!.jurisdiction).toBe("ontario");
    expect(out[0]!.source.sessionId).toBe("sess-1");
    expect(out[0]!.source.agent).toBe("judge");
    expect(out[0]!.source.crumbId).toBe("matter-123");
  });

  it("falls back to observed-gaps when no explicit lessons block exists", () => {
    const crumb = `
crumb-version: 1.2
matter:
  id: matter-456
findings:
observed-gaps:
  - "Source-of-funds documentation missing for high-risk client."
  - "Beneficial-owner certification past expiry."
`;
    const out = parseCrumbToCandidates(crumb, {
      organizationId: "org-1",
      sessionId: "sess-2",
    });
    expect(out).toHaveLength(2);
    expect(out[0]!.content).toMatch(/Source-of-funds/);
  });

  it("returns an empty list when the block has no lessons or gaps", () => {
    const crumb = `
crumb-version: 1.2
matter:
  id: matter-789
documents: []
`;
    const out = parseCrumbToCandidates(crumb, {
      organizationId: "org-1",
      sessionId: "sess-3",
    });
    expect(out).toEqual([]);
  });
});
