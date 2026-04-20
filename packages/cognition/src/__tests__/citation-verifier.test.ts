import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryCognitionStore } from "../in-memory";
import {
  CanliiUrlHeuristicVerifier,
  CompositeVerifier,
  OfflineCorpusVerifier,
  canliiCandidateUrl,
  defaultVerifier,
  summarizeVerifications,
  type VerifierCitation,
} from "../citation-verifier";

function cite(partial: Partial<VerifierCitation> = {}): VerifierCitation {
  return {
    id: partial.id ?? "c1",
    authorityId: partial.authorityId ?? "auth-test",
    section: partial.section ?? "1.1",
    ...partial,
  };
}

describe("OfflineCorpusVerifier", () => {
  let store: InMemoryCognitionStore;

  beforeEach(async () => {
    store = new InMemoryCognitionStore();
    await store.addBatch([
      {
        id: "auth-ni-45-106-2.9",
        organizationId: "preview",
        title: "NI 45-106 s. 2.9 — Offering Memorandum",
        content: "Section 2.9 — Offering Memorandum exemption.",
        jurisdiction: "multi-provincial",
        sourceType: "rule",
      },
      {
        id: "auth-pipeda-schedule-1",
        organizationId: "preview",
        title: "PIPEDA Schedule 1 — Fair Information Principles",
        content: "Schedule 1 sets out the ten fair information principles.",
        jurisdiction: "federal",
        sourceType: "statute",
      },
    ]);
  });

  it("verifies on an exact authorityId hit with confidence 1.0", async () => {
    const v = new OfflineCorpusVerifier(store);
    const r = await v.verify(cite({ authorityId: "auth-ni-45-106-2.9", section: "2.9" }));
    expect(r.status).toBe("verified");
    expect(r.method).toBe("offline-corpus");
    expect(r.confidence).toBe(1.0);
    expect(r.evidence?.matchedAuthorityId).toBe("auth-ni-45-106-2.9");
  });

  it("verifies on authority + section title match with confidence ~0.85", async () => {
    const v = new OfflineCorpusVerifier(store);
    const r = await v.verify(
      cite({
        authorityId: "auth-pipeda-schedule-1",
        section: "4.1",
        jurisdiction: "federal",
      }),
    );
    expect(r.status).toBe("verified");
    expect(r.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("returns not-found when no store item matches", async () => {
    const v = new OfflineCorpusVerifier(store);
    const r = await v.verify(
      cite({ authorityId: "auth-bogus-made-up", section: "99.99" }),
    );
    expect(r.status).toBe("not-found");
    expect(r.confidence).toBe(0);
  });

  it("respects jurisdiction filters (multi-provincial items still match provincial queries)", async () => {
    const v = new OfflineCorpusVerifier(store);
    const r = await v.verify(
      cite({
        authorityId: "auth-ni-45-106-2.9",
        section: "2.9",
        jurisdiction: "ontario",
      }),
    );
    expect(r.status).toBe("verified");
  });
});

describe("CanliiUrlHeuristicVerifier", () => {
  it("generates a SCC case URL for a case citation", async () => {
    const v = new CanliiUrlHeuristicVerifier();
    const r = await v.verify(
      cite({ authorityId: "2020 SCC 27", section: "", jurisdiction: "federal" }),
    );
    expect(r.status).toBe("candidate-url");
    expect(r.evidence?.url).toMatch(/canlii\.org/);
    expect(r.evidence?.url).toMatch(/scc/);
    expect(r.evidence?.url).toMatch(/2020/);
  });

  it("generates an ONCA case URL", () => {
    const url = canliiCandidateUrl(
      cite({ authorityId: "2022 ONCA 118", jurisdiction: "ontario" }),
    );
    expect(url).toMatch(/\/on\//);
    expect(url).toMatch(/onca/);
    expect(url).toMatch(/2022onca118/);
  });

  it("falls back to a CanLII search URL for statutes and other authorities", async () => {
    const v = new CanliiUrlHeuristicVerifier();
    const r = await v.verify(
      cite({
        authorityId: "NI 45-106",
        section: "2.9",
        jurisdiction: "ontario",
      }),
    );
    expect(r.evidence?.url).toMatch(/canlii\.org.*search/);
    // Query is URL-encoded; accept encoded or raw forms.
    expect(decodeURIComponent(r.evidence?.url ?? "")).toContain("NI 45-106");
    expect(decodeURIComponent(r.evidence?.url ?? "")).toContain("2.9");
  });

  it("always produces a URL — no citation is unverifiable at this layer", async () => {
    const v = new CanliiUrlHeuristicVerifier();
    const r = await v.verify(cite({ authorityId: "made-up-junk" }));
    expect(r.status).toBe("candidate-url");
    expect(r.evidence?.url).toBeTruthy();
  });
});

describe("CompositeVerifier", () => {
  let store: InMemoryCognitionStore;

  beforeEach(async () => {
    store = new InMemoryCognitionStore();
    await store.addBatch([
      {
        id: "auth-ni-45-106-2.9",
        organizationId: "preview",
        title: "NI 45-106 s. 2.9",
        content: "OM exemption.",
        jurisdiction: "multi-provincial",
      },
    ]);
  });

  it("stops at the first verified result (offline-corpus hit)", async () => {
    const composite = new CompositeVerifier([
      new OfflineCorpusVerifier(store),
      new CanliiUrlHeuristicVerifier(),
    ]);
    const r = await composite.verify(
      cite({ authorityId: "auth-ni-45-106-2.9", section: "2.9" }),
    );
    expect(r.status).toBe("verified");
    expect(r.method).toBe("offline-corpus");
  });

  it("falls through to the URL heuristic when offline misses", async () => {
    const composite = new CompositeVerifier([
      new OfflineCorpusVerifier(store),
      new CanliiUrlHeuristicVerifier(),
    ]);
    const r = await composite.verify(
      cite({ authorityId: "2020 SCC 27", section: "" }),
    );
    expect(r.status).toBe("candidate-url");
    expect(r.method).toBe("canlii-url-heuristic");
  });

  it("returns not-found when every verifier misses and the last is offline", async () => {
    const composite = new CompositeVerifier([new OfflineCorpusVerifier(store)]);
    const r = await composite.verify(cite({ authorityId: "auth-bogus" }));
    expect(r.status).toBe("not-found");
  });

  it("handles verifier errors gracefully", async () => {
    const throwing: import("../citation-verifier").CitationVerifier = {
      async verify() {
        throw new Error("boom");
      },
      async verifyBatch() {
        throw new Error("boom");
      },
    };
    const composite = new CompositeVerifier([throwing, new CanliiUrlHeuristicVerifier()]);
    const r = await composite.verify(cite());
    // The URL heuristic is the last verifier and always succeeds.
    expect(r.status).toBe("candidate-url");
  });
});

describe("defaultVerifier + summarizeVerifications", () => {
  let store: InMemoryCognitionStore;

  beforeEach(async () => {
    store = new InMemoryCognitionStore();
    await store.addBatch([
      {
        id: "auth-ni-45-106-2.9",
        organizationId: "preview",
        title: "NI 45-106 s. 2.9",
        content: "OM.",
        jurisdiction: "multi-provincial",
      },
    ]);
  });

  it("summarizes a batch across status categories", async () => {
    const v = defaultVerifier(store);
    const results = await v.verifyBatch([
      cite({ id: "c1", authorityId: "auth-ni-45-106-2.9", section: "2.9" }),
      cite({ id: "c2", authorityId: "2020 SCC 27", section: "" }),
      cite({ id: "c3", authorityId: "bogus-made-up-id", section: "" }),
    ]);
    expect(results).toHaveLength(3);
    const s = summarizeVerifications(results);
    expect(s.total).toBe(3);
    expect(s.verified).toBe(1);
    // Bogus id still gets a candidate-url from the URL heuristic (no
    // offline match, heuristic always succeeds), so the breakdown is
    // 1 verified + 2 candidate-url.
    expect(s.candidateUrl).toBe(2);
    expect(s.notFound).toBe(0);
  });
});
