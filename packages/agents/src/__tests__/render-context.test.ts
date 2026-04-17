import { describe, expect, it } from "vitest";
import { renderCognitionContext } from "../run.js";
import type { RetrievedSnippet } from "../types.js";

describe("renderCognitionContext", () => {
  it("emits a RETRIEVAL-GAP directive when snippets are empty", () => {
    // Critical: when retrieval returns zero items, we need the model to KNOW
    // that — otherwise the persona's default "cite everything with [cN]"
    // habit produces orphan markers and empty citations blocks that the
    // downstream citation-validator has no authorities to match against.
    const output = renderCognitionContext([]);
    expect(output).not.toBe("");
    expect(output).toMatch(/No authorities were retrieved/i);
    expect(output).toMatch(/MUST NOT fabricate/i);
    expect(output).toMatch(/RETRIEVAL GAP/i);
    // It should NOT include the CITATION_INSTRUCTION, which assumes there
    // are authorities worth citing. The empty block tells the model to
    // emit no citations fence.
    expect(output).not.toMatch(/Every \[cN\] marker in your prose MUST have/);
  });

  it("renders authority snippets with titles, docIds, and relevance scores", () => {
    const snippets: RetrievedSnippet[] = [
      {
        id: "auth-ni-45-106-2.9",
        title: "NI 45-106 Section 2.9 Offering memorandum",
        content: "The prospectus requirement does not apply to a distribution...",
        source: "CSA consolidation 2025-12-04",
        score: 0.85,
      },
      {
        id: "auth-osc-rule-45-501-5.2",
        title: "OSC Rule 45-501 s. 5.2 Rights of action",
        content: "An offering memorandum delivered under section 2.9 of NI 45-106 must contain...",
        source: "Ontario Securities Commission",
        score: 0.67,
      },
    ];

    const output = renderCognitionContext(snippets);
    expect(output).toContain("## Retrieved tenant context");
    expect(output).toContain("NI 45-106 Section 2.9 Offering memorandum");
    expect(output).toContain("OSC Rule 45-501 s. 5.2 Rights of action");
    expect(output).toContain("docId: auth-ni-45-106-2.9");
    expect(output).toContain("docId: auth-osc-rule-45-501-5.2");
    expect(output).toContain("relevance 0.85");
    expect(output).toContain("relevance 0.67");
    expect(output).toContain("CSA consolidation 2025-12-04");
    // CITATION_INSTRUCTION must be present when authorities ARE available —
    // it's what tells the model how to emit the structured ```citations
    // fence that parseModelOutput parses.
    expect(output).toMatch(/bracketed markers: \[c1\], \[c2\]/);
    expect(output).toMatch(/```citations/);
  });

  it("preserves snippet content verbatim so the model can produce accurate quotes", () => {
    const verbatim =
      "The issuer must deliver to the purchaser a completed risk acknowledgement form.";
    const snippets: RetrievedSnippet[] = [
      {
        id: "auth-ni-45-106-6.5",
        title: "NI 45-106 s. 6.5 Risk acknowledgement",
        content: verbatim,
        score: 0.91,
      },
    ];
    const output = renderCognitionContext(snippets);
    expect(output).toContain(verbatim);
  });
});
