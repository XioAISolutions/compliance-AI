import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryCognitionStore,
  setDefaultCognitionStore,
} from "@compliance-ai/cognition";
import { emitAutoVerifySseFrame } from "../auto-verify";

/**
 * Tests for the server-side auto-verify hook. Guarantees that after a
 * review emits its citations, a follow-up SSE frame of type
 * `verifications` is enqueued with results keyed to every input citation.
 * This is the mechanism that makes the matter page land already
 * colour-coded.
 */

function makeFakeController() {
  const chunks: string[] = [];
  const controller = {
    enqueue(buf: Uint8Array) {
      chunks.push(new TextDecoder().decode(buf));
    },
  } as unknown as ReadableStreamDefaultController<Uint8Array>;
  return { controller, chunks };
}

function parseFrames(chunks: string[]): unknown[] {
  return chunks
    .flatMap((chunk) => chunk.split("\n\n"))
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)));
}

describe("emitAutoVerifySseFrame", () => {
  beforeEach(async () => {
    const store = new InMemoryCognitionStore();
    await store.add({
      id: "auth-ni-45-106-2.9",
      organizationId: "preview",
      title: "NI 45-106 s. 2.9",
      content: "OM exemption.",
      jurisdiction: "multi-provincial",
    });
    setDefaultCognitionStore(store, "securities");
  });

  it("enqueues a `verifications` frame with summary + results", async () => {
    const { controller, chunks } = makeFakeController();
    const encoder = new TextEncoder();
    await emitAutoVerifySseFrame(
      controller,
      encoder,
      [
        { id: "c1", authorityId: "auth-ni-45-106-2.9", section: "2.9" },
        { id: "c2", authorityId: "2020 SCC 27", section: "" },
      ],
      "preview",
    );
    const frames = parseFrames(chunks) as Array<{
      type: string;
      summary: { total: number; verified: number; candidateUrl: number };
      results: Array<{ citationId: string; status: string }>;
    }>;
    expect(frames).toHaveLength(1);
    expect(frames[0]!.type).toBe("verifications");
    expect(frames[0]!.summary.total).toBe(2);
    expect(frames[0]!.summary.verified).toBe(1);
    expect(frames[0]!.summary.candidateUrl).toBe(1);
    expect(frames[0]!.results.map((r) => r.citationId)).toEqual(["c1", "c2"]);
  });

  it("is a no-op when the citations list is empty", async () => {
    const { controller, chunks } = makeFakeController();
    const encoder = new TextEncoder();
    await emitAutoVerifySseFrame(controller, encoder, [], "preview");
    expect(chunks).toHaveLength(0);
  });

  it("survives offline-verifier failures by falling through to the URL heuristic", async () => {
    // Break store.get so the OfflineCorpusVerifier throws. The composite
    // verifier catches per-verifier errors and falls through to the
    // CanLII URL heuristic, which always succeeds. The review stream
    // still gets a `verifications` frame; the reviewer just sees
    // candidate-url badges instead of green verified ones.
    setDefaultCognitionStore(
      {
        // @ts-expect-error intentionally partial — the fields we provide
        // are enough for the CompositeVerifier to reach the URL heuristic.
        async get() {
          throw new Error("store unreachable");
        },
        async retrieve() {
          return [];
        },
      },
      "securities",
    );
    const { controller, chunks } = makeFakeController();
    const encoder = new TextEncoder();
    await emitAutoVerifySseFrame(
      controller,
      encoder,
      [{ id: "c1", authorityId: "auth-x", section: "1" }],
      "preview",
    );
    const frames = parseFrames(chunks) as Array<{
      type: string;
      summary: { candidateUrl: number; verified: number };
    }>;
    expect(frames).toHaveLength(1);
    expect(frames[0]!.summary.candidateUrl).toBe(1);
    expect(frames[0]!.summary.verified).toBe(0);
  });
});
