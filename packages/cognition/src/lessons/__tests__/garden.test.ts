import { describe, it, expect, beforeEach } from "vitest";
import { CognitionGarden } from "../garden.js";
import { CognitionSidecar } from "../sidecar.js";
import { InMemoryLessonStore } from "../in-memory-store.js";
import { DeterministicEmbedder } from "../embedding.js";
import { ResourceCalculator } from "../resources.js";
import { InMemoryMetrics } from "../metrics.js";
import { GardenScheduler } from "../scheduler.js";
import { InMemoryWakeQueue } from "../queue.js";

function setup() {
  const store = new InMemoryLessonStore();
  const embedder = new DeterministicEmbedder();
  const metrics = new InMemoryMetrics();
  const sidecar = new CognitionSidecar(store, embedder, {
    similarityThreshold: 0.85,
    metrics,
  });
  const resources = new ResourceCalculator({
    tokensPerHour: 100_000,
    ambientTokenCapPerCycle: 5_000,
    rateLimitMargin: 0.1,
  });
  const garden = new CognitionGarden(store, embedder, sidecar, resources, metrics, {
    similarityThreshold: 0.9,
  });
  return { store, embedder, sidecar, resources, garden, metrics };
}

describe("CognitionGarden", () => {
  let s: ReturnType<typeof setup>;

  beforeEach(() => {
    s = setup();
  });

  it("skips a cycle when a live agent is active", async () => {
    s.resources.beginLiveAgent();
    const report = await s.garden.runCycle({ organizationId: "org-1" });
    expect(report.audit.some((line) => line.includes("skipped"))).toBe(true);
    expect(report.result.dedupRemoved).toBe(0);
    s.resources.endLiveAgent();
  });

  it("dedups near-duplicate lessons across cycles", async () => {
    // Insert two near-identical lessons by hand (bypassing the sidecar
    // threshold so we can prove the garden's own dedup works).
    const e1 = await s.embedder.embed("KYC files must include source-of-funds documentation.");
    const e2 = await s.embedder.embed("KYC files must include source of funds documentation.");
    await s.store.insert({
      organizationId: "org-1",
      content: "KYC files must include source-of-funds documentation.",
      embedding: e1,
      weight: 3,
      sources: [{ sessionId: "s1", observedAt: new Date() }],
      tags: [],
      status: "active",
    });
    await s.store.insert({
      organizationId: "org-1",
      content: "KYC files must include source of funds documentation.",
      embedding: e2,
      weight: 1,
      sources: [{ sessionId: "s2", observedAt: new Date() }],
      tags: [],
      status: "active",
    });

    const report = await s.garden.runCycle({ organizationId: "org-1" });
    expect(report.result.dedupRemoved).toBeGreaterThanOrEqual(1);
    const active = await s.store.list("org-1");
    expect(active.length).toBe(1);
    expect(active[0]!.weight).toBeGreaterThanOrEqual(3);
  });

  it("prunes lessons whose anchor framework has been retired", async () => {
    const embedding = await s.embedder.embed("EU AI Act Article 9 risk-management documentation.");
    await s.store.insert({
      organizationId: "org-1",
      content: "EU AI Act Article 9 risk-management documentation.",
      embedding,
      weight: 1,
      sources: [{ sessionId: "s1", observedAt: new Date() }],
      tags: [],
      framework: "eu-ai-act",
      status: "active",
    });

    const report = await s.garden.runCycle({
      organizationId: "org-1",
      liveAnchors: [{ framework: "eu-ai-act", live: false }],
    });
    expect(report.result.pruned).toBe(1);
    expect(await s.store.size()).toBe(0);
  });

  it("retroactively extracts lessons from crashed sessions", async () => {
    const report = await s.garden.runCycle({
      organizationId: "org-1",
      crashedSessions: [
        {
          sessionId: "session-crashed",
          candidates: [
            {
              organizationId: "org-1",
              content: "Auditor flagged inadequate retention period for KYC files.",
              source: { sessionId: "session-crashed", observedAt: new Date() },
              tags: ["kyc"],
            },
          ],
        },
      ],
    });
    expect(report.result.retroactiveIngests).toBe(1);
    expect(await s.store.size()).toBe(1);
  });
});

describe("GardenScheduler", () => {
  it("persists wake envelopes and drains them in order", async () => {
    const { garden } = setup();
    const queue = new InMemoryWakeQueue();
    const scheduler = new GardenScheduler(garden, queue);
    scheduler.notifySessionClose("org-1");
    scheduler.notifyCorpusCommit("org-1", "abc1234");
    expect(queue.pending().length).toBe(2);
    const reports = await scheduler.drain();
    expect(reports.length).toBe(2);
    expect(queue.pending().length).toBe(0);
  });

  it("ignores wildcard timer wakes (organizationId='*')", async () => {
    const { garden } = setup();
    const queue = new InMemoryWakeQueue();
    const scheduler = new GardenScheduler(garden, queue);
    queue.enqueue({ trigger: "timer", organizationId: "*" });
    const reports = await scheduler.drain();
    expect(reports.length).toBe(0);
    expect(queue.pending().length).toBe(0);
  });
});
