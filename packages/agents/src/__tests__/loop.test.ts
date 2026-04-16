import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the multi-persona loop coordinator.
 *
 * We mock `runAgent` to produce deterministic drafts so we can assert on the
 * downstream events (citations, tool-call, mention, verdict-final) without
 * hitting the Anthropic API.
 */

/**
 * Local loose-event type. The real `AgentEvent` from ../types is a
 * discriminated union, and asserting specific properties on a narrowed
 * branch requires either exhaustive switching or casting through unknown.
 * Tests read into a loose record and assert properties directly.
 */
interface AnyEvent {
  type: string;
  [k: string]: unknown;
}

// Build a fake runAgent that returns a specified sequence of text-delta
// chunks. We call it sequentially: the first call returns the drafter
// output, the second the judge output, etc.
function makeFakeRunAgent(scripts: string[]) {
  let call = 0;
  return async function* fake(): AsyncGenerator<AnyEvent> {
    const text = scripts[call] ?? "";
    call++;
    yield { type: "persona-selected", persona: "drafter", reason: "forced" };
    yield { type: "text-delta", delta: text };
    yield {
      type: "done",
      usage: { inputTokens: 10, outputTokens: 10, cacheReadTokens: 0 },
    };
  };
}

describe("runAgentLoop", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("emits citations event carrying parsed Citation[] after a drafter round", async () => {
    const draft = [
      "Section 2.9 requires rights of action for misrepresentation [c1].",
      "",
      "```citations",
      JSON.stringify([
        {
          id: "c1",
          authorityId: "ni-45-106",
          section: "2.9(2)(a)",
          quote: "rights of action",
          docId: "om",
          chunkId: "chunk-7",
        },
      ]),
      "```",
    ].join("\n");

    const judgeOutput = "Looks good.\n\nREADY_TO_SUBMIT";

    vi.doMock("../run.js", () => ({
      runAgent: makeFakeRunAgent([draft, judgeOutput]),
    }));

    const { runAgentLoop } = await import("../loop.js");

    const events: AnyEvent[] = [];
    const context = {
      control: null,
      frameworkScope: [],
      organizationId: "org-1",
      retrievedSnippets: [
        {
          id: "chunk-7",
          title: "NI 45-106 s. 2.9",
          content: "…",
          score: 1,
        },
      ],
    };

    for await (const ev of runAgentLoop(context as never, "review this OM", {
      maxRounds: 1,
      leadPersona: "om-reviewer",
    })) {
      events.push(ev);
    }

    const citationsEv = events.find((e) => e.type === "citations");
    expect(citationsEv).toBeDefined();
    expect((citationsEv as unknown as { citations: unknown[] }).citations).toHaveLength(1);
    expect((citationsEv as unknown as { persona: string }).persona).toBe("om-reviewer");
    expect((citationsEv as unknown as { redactedText: string }).redactedText).not.toContain(
      "```citations",
    );
  });

  it("emits tool-call events when the drafter emits a tool block", async () => {
    const draft = [
      "Here's a compliance gap I found.",
      `{{tool:flag_gap {"severity":"high","title":"Missing rights of action","description":"…"}}}`,
    ].join("\n");
    const judgeOutput = "Acceptable.\n\nREADY_TO_SUBMIT";

    vi.doMock("../run.js", () => ({
      runAgent: makeFakeRunAgent([draft, judgeOutput]),
    }));

    const { runAgentLoop } = await import("../loop.js");

    const events: AnyEvent[] = [];
    const context = {
      control: null,
      frameworkScope: [],
      organizationId: "org-1",
    };
    for await (const ev of runAgentLoop(context as never, "kick it off", {
      maxRounds: 1,
      leadPersona: "om-reviewer",
    })) {
      events.push(ev);
    }

    const toolEvents = events.filter((e) => e.type === "tool-call");
    expect(toolEvents).toHaveLength(1);
    expect(toolEvents[0]).toMatchObject({
      persona: "om-reviewer",
      tool: "flag_gap",
    });
  });

  it("dispatches a follow-up round for each @mentioned persona before the judge", async () => {
    const draft = "I need exposure analysis @risk-assessor please advise.";
    const followup = "Exposure analysis done.";
    const judgeOutput = "OK.\n\nREADY_TO_SUBMIT";

    vi.doMock("../run.js", () => ({
      runAgent: makeFakeRunAgent([draft, followup, judgeOutput]),
    }));

    const { runAgentLoop } = await import("../loop.js");

    const events: AnyEvent[] = [];
    const context = {
      control: null,
      frameworkScope: [],
      organizationId: "org-1",
    };
    for await (const ev of runAgentLoop(context as never, "kick it off", {
      maxRounds: 1,
      leadPersona: "drafter",
    })) {
      events.push(ev);
    }

    const mentionEv = events.find((e) => e.type === "mention");
    expect(mentionEv).toBeDefined();
    expect((mentionEv as unknown as { to: string }).to).toBe("risk-assessor");

    const roundStarts = events
      .filter((e) => e.type === "round-started")
      .map((e) => (e as unknown as { persona: string }).persona);
    // Expect: drafter (lead), risk-assessor (followup), judge.
    expect(roundStarts).toEqual(["drafter", "risk-assessor", "judge"]);
  });

  it("hand_off tool call drives a follow-up round", async () => {
    const draft = `Hand this to reviewer.
{{tool:hand_off {"to":"reviewer","reason":"need second set of eyes"}}}`;
    const followup = "Second review: looks fine.";
    const judgeOutput = "READY_TO_SUBMIT";

    vi.doMock("../run.js", () => ({
      runAgent: makeFakeRunAgent([draft, followup, judgeOutput]),
    }));

    const { runAgentLoop } = await import("../loop.js");

    const events: AnyEvent[] = [];
    const context = {
      control: null,
      frameworkScope: [],
      organizationId: "org-1",
    };
    for await (const ev of runAgentLoop(context as never, "do it", {
      maxRounds: 1,
      leadPersona: "drafter",
    })) {
      events.push(ev);
    }

    const roundPersonas = events
      .filter((e) => e.type === "round-started")
      .map((e) => (e as unknown as { persona: string }).persona);
    expect(roundPersonas).toContain("reviewer");
  });
});
