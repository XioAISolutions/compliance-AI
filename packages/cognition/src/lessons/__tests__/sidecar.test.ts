import { describe, it, expect, beforeEach } from "vitest";
import { CognitionSidecar } from "../sidecar.js";
import { InMemoryLessonStore } from "../in-memory-store.js";
import { DeterministicEmbedder } from "../embedding.js";
import { InMemoryMetrics } from "../metrics.js";
import type { LessonCandidate } from "../types.js";

function candidate(overrides: Partial<LessonCandidate>): LessonCandidate {
  return {
    organizationId: "org-1",
    content: "When reviewing Ontario EMD offering memos, always check NI 33-109 disclosure.",
    source: { sessionId: "session-1", observedAt: new Date() },
    tags: ["om-review"],
    ...overrides,
  };
}

describe("CognitionSidecar", () => {
  let store: InMemoryLessonStore;
  let embedder: DeterministicEmbedder;
  let metrics: InMemoryMetrics;
  let sidecar: CognitionSidecar;

  beforeEach(() => {
    store = new InMemoryLessonStore();
    embedder = new DeterministicEmbedder();
    metrics = new InMemoryMetrics();
    sidecar = new CognitionSidecar(store, embedder, {
      similarityThreshold: 0.85,
      metrics,
    });
  });

  it("inserts a fresh lesson when the store is empty", async () => {
    const result = await sidecar.consolidate(candidate({}));
    expect(result.action).toBe("inserted");
    expect(await store.size()).toBe(1);
    const stored = await store.get(result.lesson.id);
    expect(stored?.weight).toBe(1);
    expect(stored?.embedding).toBeTruthy();
    expect(stored?.embedding!.length).toBe(embedder.dimension);
  });

  it("reinforces a near-duplicate lesson instead of inserting", async () => {
    await sidecar.consolidate(
      candidate({
        content: "When reviewing Ontario EMD offering memos always check NI 33-109 disclosure",
        source: { sessionId: "session-A", observedAt: new Date() },
      }),
    );
    const result = await sidecar.consolidate(
      candidate({
        content:
          "When reviewing Ontario EMD offering memos, always check NI 33-109 disclosure obligations.",
        source: { sessionId: "session-B", observedAt: new Date() },
      }),
    );
    expect(result.action).toBe("reinforced");
    expect(await store.size()).toBe(1);
    const lessons = await store.list("org-1");
    expect(lessons[0]!.weight).toBe(2);
    expect(lessons[0]!.sources.map((s) => s.sessionId)).toContain("session-A");
    expect(lessons[0]!.sources.map((s) => s.sessionId)).toContain("session-B");
  });

  it("supersedes an existing lesson when content contradicts", async () => {
    const original = await sidecar.consolidate(
      candidate({
        content: "Issuers must file the report within 10 days of distribution.",
        source: { sessionId: "session-old", observedAt: new Date() },
      }),
    );
    const result = await sidecar.consolidate(
      candidate({
        content: "Issuers must file the report within 30 days of distribution.",
        source: { sessionId: "session-new", observedAt: new Date() },
      }),
    );
    expect(result.action).toBe("superseded");
    const oldLesson = await store.get(original.lesson.id);
    expect(oldLesson?.status).toBe("superseded");
    expect(oldLesson?.supersededBy).toBe(result.lesson.id);
    const relations = await store.listRelations(original.lesson.id);
    expect(relations.find((r) => r.type === "supersedes")).toBeTruthy();
  });

  it("supersedes on negation flip", async () => {
    await sidecar.consolidate(
      candidate({
        content: "Marketing decks for accredited investors must include past performance disclaimers.",
        source: { sessionId: "session-old", observedAt: new Date() },
      }),
    );
    const result = await sidecar.consolidate(
      candidate({
        content: "Marketing decks for accredited investors must not include past performance disclaimers.",
        source: { sessionId: "session-new", observedAt: new Date() },
      }),
    );
    expect(result.action).toBe("superseded");
  });

  it("inserts a fresh lesson when no candidate clears the threshold", async () => {
    await sidecar.consolidate(
      candidate({ content: "Ontario EMD KYC requires beneficial-owner certification." }),
    );
    const result = await sidecar.consolidate(
      candidate({
        content: "Quebec exempt-distribution filings demand French-language summaries.",
      }),
    );
    expect(result.action).toBe("inserted");
    expect(await store.size()).toBe(2);
  });

  it("stays under the 200ms latency budget for an empty store", async () => {
    const result = await sidecar.consolidate(candidate({}));
    expect(result.durationMs).toBeLessThan(200);
  });

  it("records metrics for each action", async () => {
    await sidecar.consolidate(candidate({}));
    await sidecar.consolidate(candidate({}));
    const snap = metrics.snapshot();
    expect(snap.insertedCount).toBe(1);
    expect(snap.reinforcedCount).toBe(1);
    expect(snap.reinforceRatio).toBeCloseTo(0.5, 5);
  });
});
