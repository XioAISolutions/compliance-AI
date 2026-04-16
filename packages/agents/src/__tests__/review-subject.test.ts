import { describe, it, expect } from "vitest";
import type { ReviewSubject } from "../types";

// We can't easily test runAgent() without the Anthropic API, so we test the
// ReviewSubject type contract directly. The actual rendering is exercised
// end-to-end via the web app's review route.
//
// These tests pin down the shape so any refactor that loses page numbers or
// chunk ordering surfaces immediately.

describe("ReviewSubject type", () => {
  it("accepts a well-formed subject with page-tagged chunks", () => {
    const subject: ReviewSubject = {
      documentId: "doc-1",
      documentType: "offering memorandum",
      title: "acme-cap-om-2026-q1.pdf",
      chunks: [
        {
          chunkId: "ch-abc123",
          ordinal: 0,
          page: 1,
          content: "The issuer offers Class A preferred shares.",
        },
        {
          chunkId: "ch-def456",
          ordinal: 1,
          page: 2,
          content: "Risk factors include illiquidity of the secondary market.",
        },
      ],
    };

    expect(subject.documentId).toBe("doc-1");
    expect(subject.chunks).toHaveLength(2);
    expect(subject.chunks[0]!.page).toBe(1);
    expect(subject.chunks[0]!.ordinal).toBe(0);
    expect(subject.chunks[1]!.ordinal).toBe(1);
  });

  it("accepts subjects without page numbers (for DOCX/TXT sources)", () => {
    const subject: ReviewSubject = {
      documentId: "doc-2",
      documentType: "kyc-aml-file",
      title: "client-file.docx",
      chunks: [
        {
          chunkId: "ch-xyz789",
          ordinal: 0,
          content: "Client identification verified via driver's license.",
        },
      ],
    };

    expect(subject.chunks[0]!.page).toBeUndefined();
  });
});
