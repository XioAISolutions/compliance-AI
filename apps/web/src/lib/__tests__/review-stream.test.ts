import { describe, it, expect } from "vitest";
import type { AgentEvent } from "@compliance-ai/agents";
import { applyEvent, finalizeReview, newReviewStreamState } from "../review-stream";

/**
 * These tests pin down the "clean final deliverable" semantics that the
 * review route relies on. The bug they guard against: the reviewer emits
 * text-deltas across drafter + judge rounds, and if the route accumulates
 * all of them naively, the UI + audit trail + DOCX export all receive a
 * garbled transcript instead of the final draft with parsed citations.
 */

describe("review-stream applyEvent", () => {
  it("starts with empty state", () => {
    const s = newReviewStreamState();
    expect(s.currentPersona).toBeNull();
    expect(s.activeDrafterOutput).toBe("");
    expect(s.lastRound).toBe(0);
    expect(s.lastVerdict).toBeNull();
    expect(s.totalRounds).toBe(0);
  });

  it("captures drafter output across deltas", () => {
    const s = newReviewStreamState();
    const events: AgentEvent[] = [
      { type: "round-started", round: 1, persona: "om-reviewer" },
      { type: "text-delta", delta: "## Checklist\n\n" },
      { type: "text-delta", delta: "| # | Requirement | Status |\n" },
      { type: "text-delta", delta: "| 1 | Risk factors | FOUND |\n" },
    ];
    for (const e of events) applyEvent(s, e);
    expect(s.currentPersona).toBe("om-reviewer");
    expect(s.activeDrafterOutput).toBe(
      "## Checklist\n\n| # | Requirement | Status |\n| 1 | Risk factors | FOUND |\n",
    );
  });

  it("excludes judge text-deltas from the drafter output", () => {
    const s = newReviewStreamState();
    const events: AgentEvent[] = [
      { type: "round-started", round: 1, persona: "om-reviewer" },
      { type: "text-delta", delta: "Draft content." },
      { type: "round-started", round: 1, persona: "judge" },
      { type: "text-delta", delta: "The draft misses risk factors." },
      { type: "text-delta", delta: "\nITERATE" },
    ];
    for (const e of events) applyEvent(s, e);
    // Drafter output should only be the drafter's content — not the judge's
    // rationale.
    expect(s.activeDrafterOutput).toBe("Draft content.");
  });

  it("captures the judge's rationale in activeJudgeOutput", () => {
    // The review route forwards the judge's rationale to the UI as a
    // verdict-rationale SSE event when the matter doesn't hit
    // READY_TO_SUBMIT — a compliance lawyer needs to see WHY the draft
    // got rejected, not just the "Rewriting" chip.
    const s = newReviewStreamState();
    const events: AgentEvent[] = [
      { type: "round-started", round: 1, persona: "om-reviewer" },
      { type: "text-delta", delta: "Cover page is missing issuer name." },
      { type: "round-started", round: 1, persona: "judge" },
      { type: "text-delta", delta: "Risk factors section is too generic. " },
      { type: "text-delta", delta: "Use of proceeds needs itemization. " },
      { type: "text-delta", delta: "ITERATE" },
    ];
    for (const e of events) applyEvent(s, e);
    expect(s.activeJudgeOutput).toBe(
      "Risk factors section is too generic. Use of proceeds needs itemization. ITERATE",
    );
  });

  it("resets judge rationale on each new judge round (most-recent-wins)", () => {
    // The UI shows the judge's LAST critique — an R3 rationale is more
    // relevant than an R1 rationale that's since been addressed.
    const s = newReviewStreamState();
    const events: AgentEvent[] = [
      { type: "round-started", round: 1, persona: "judge" },
      { type: "text-delta", delta: "R1 rationale: missing risk factors." },
      { type: "verdict-final", verdict: "ITERATE" },
      { type: "round-started", round: 2, persona: "om-reviewer" },
      { type: "text-delta", delta: "Round 2 draft with risk factors." },
      { type: "round-started", round: 2, persona: "judge" },
      { type: "text-delta", delta: "R2 rationale: risk factors present but shallow." },
    ];
    for (const e of events) applyEvent(s, e);
    expect(s.activeJudgeOutput).toBe("R2 rationale: risk factors present but shallow.");
  });

  it("resets drafter output when a new drafter round starts (R2+)", () => {
    const s = newReviewStreamState();
    const events: AgentEvent[] = [
      { type: "round-started", round: 1, persona: "om-reviewer" },
      { type: "text-delta", delta: "Round 1 draft — missing risk factors." },
      { type: "round-started", round: 1, persona: "judge" },
      { type: "text-delta", delta: "ITERATE" },
      { type: "verdict-final", verdict: "ITERATE" },
      { type: "round-started", round: 2, persona: "om-reviewer" },
      { type: "text-delta", delta: "Round 2 draft — now with risk factors." },
    ];
    for (const e of events) applyEvent(s, e);
    // The stale R1 draft is gone; only the R2 revision remains.
    expect(s.activeDrafterOutput).toBe("Round 2 draft — now with risk factors.");
    expect(s.lastVerdict).toBe("ITERATE");
  });

  it("tracks lastVerdict across verdict-final events", () => {
    const s = newReviewStreamState();
    applyEvent(s, { type: "verdict-final", verdict: "ITERATE" });
    expect(s.lastVerdict).toBe("ITERATE");
    applyEvent(s, { type: "verdict-final", verdict: "READY_TO_SUBMIT" });
    expect(s.lastVerdict).toBe("READY_TO_SUBMIT");
  });

  it("loop-done writes totalRounds + finalVerdict", () => {
    const s = newReviewStreamState();
    applyEvent(s, {
      type: "loop-done",
      totalRounds: 2,
      finalVerdict: "READY_TO_SUBMIT",
    });
    expect(s.totalRounds).toBe(2);
    expect(s.lastVerdict).toBe("READY_TO_SUBMIT");
  });

  it("loop-done with null finalVerdict preserves the prior verdict", () => {
    const s = newReviewStreamState();
    applyEvent(s, { type: "verdict-final", verdict: "ITERATE" });
    applyEvent(s, { type: "loop-done", totalRounds: 3, finalVerdict: null });
    expect(s.lastVerdict).toBe("ITERATE");
    expect(s.totalRounds).toBe(3);
  });

  it("ignores pass-through events (done, error, persona-selected)", () => {
    const s = newReviewStreamState();
    applyEvent(s, { type: "persona-selected", persona: "om-reviewer", reason: "test" });
    applyEvent(s, {
      type: "done",
      usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 0 },
    });
    applyEvent(s, { type: "error", message: "test error" });
    expect(s.activeDrafterOutput).toBe("");
    expect(s.lastVerdict).toBeNull();
  });
});

describe("review-stream finalizeReview", () => {
  it("parses prose + citations out of the drafter output", () => {
    const s = newReviewStreamState();
    applyEvent(s, { type: "round-started", round: 1, persona: "om-reviewer" });
    applyEvent(s, {
      type: "text-delta",
      delta: `## Gap Memo

The offering memorandum lacks adequate risk factor disclosure [c1] and
does not include the rights of action statement required by [c2].

\`\`\`citations
[
  {"id": "c1", "authorityId": "ni-45-106", "section": "2.9(2)(c)(ii)", "quote": "risk factors relating to the issuer's business", "docId": "auth-ni-45-106-2.9", "chunkId": "ch-1"},
  {"id": "c2", "authorityId": "osc-rule-45-501", "section": "5.2", "quote": "statement of the rights of action for damages or rescission", "docId": "auth-osc-rule-45-501-5.2", "chunkId": "ch-2"}
]
\`\`\``,
    });

    const { prose, citations } = finalizeReview(s);
    expect(citations).toHaveLength(2);
    expect(citations[0]!.id).toBe("c1");
    expect(citations[0]!.authorityId).toBe("ni-45-106");
    expect(citations[1]!.section).toBe("5.2");
    // Prose still contains the [cN] markers so the UI can render superscripts,
    // but the ```citations fence is stripped.
    expect(prose).toContain("[c1]");
    expect(prose).toContain("[c2]");
    expect(prose).not.toContain("```citations");
  });

  it("returns empty citations when the output has no fence block", () => {
    const s = newReviewStreamState();
    applyEvent(s, { type: "round-started", round: 1, persona: "om-reviewer" });
    applyEvent(s, { type: "text-delta", delta: "Just prose, no citations." });
    const { prose, citations } = finalizeReview(s);
    expect(citations).toEqual([]);
    expect(prose).toBe("Just prose, no citations.");
  });

  it("finalizes using ONLY the last drafter round's output", () => {
    const s = newReviewStreamState();
    const events: AgentEvent[] = [
      { type: "round-started", round: 1, persona: "om-reviewer" },
      { type: "text-delta", delta: "Round 1 (stale) [c1]" },
      { type: "round-started", round: 1, persona: "judge" },
      { type: "text-delta", delta: "judge noise" },
      { type: "round-started", round: 2, persona: "om-reviewer" },
      {
        type: "text-delta",
        delta: `Round 2 (final) [c1]

\`\`\`citations
[{"id":"c1","authorityId":"ni-45-106","section":"2.9","quote":"final","docId":"d","chunkId":"ch"}]
\`\`\``,
      },
      { type: "loop-done", totalRounds: 2, finalVerdict: "READY_TO_SUBMIT" },
    ];
    for (const e of events) applyEvent(s, e);
    const { prose, citations } = finalizeReview(s);
    expect(prose).not.toContain("Round 1");
    expect(prose).not.toContain("judge noise");
    expect(prose).toContain("Round 2 (final)");
    expect(citations).toHaveLength(1);
    expect(citations[0]!.quote).toBe("final");
  });

  it("surfaces orphaned markers when model emits a [cN] with no matching citation entry", () => {
    const s = newReviewStreamState();
    applyEvent(s, { type: "round-started", round: 1, persona: "om-reviewer" });
    applyEvent(s, {
      type: "text-delta",
      delta: `Text with [c1] and [c99].

\`\`\`citations
[{"id":"c1","authorityId":"x","section":"y","quote":"z","docId":"d","chunkId":"ch"}]
\`\`\``,
    });
    const { orphanedMarkers } = finalizeReview(s);
    expect(orphanedMarkers).toEqual(["c99"]);
  });
});
