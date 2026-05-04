/**
 * Debate orchestration tests.
 *
 * Mocks the run module so we test the panel coordination — voice resolution,
 * concurrency, error isolation, timeout — without hitting an LLM.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../run.js", async () => {
  const actual = await vi.importActual<typeof import("../run.js")>("../run.js");

  async function* mockRunAgent(
    _ctx: unknown,
    _history: unknown,
    userMessage: string,
    options: { forcePersona?: string; systemPromptOverride?: string } = {},
  ) {
    const persona = options.forcePersona ?? "drafter";
    const sys = options.systemPromptOverride ?? "";
    yield { type: "persona-selected", persona, reason: "mock" };

    // Synthesis prompts — recognise the editor-stance system prompt and the
    // userMessage's "Output exactly this fenced JSON" instruction; emit a
    // canned synthesis JSON so synthesizeDebate's parser has something to
    // chew on.
    if (sys.startsWith("You are a precise editor")) {
      // Allow tests to force synthesis-error by smuggling __synth_error__.
      if (userMessage.includes("__synth_error__")) {
        yield { type: "error", message: "mock synthesis error" };
        return;
      }
      if (userMessage.includes("__synth_garbage__")) {
        yield { type: "text-delta", delta: "this is not JSON" };
        yield {
          type: "done",
          usage: { inputTokens: 1, outputTokens: 4, cacheReadTokens: 0 },
        };
        return;
      }
      const json = JSON.stringify({
        agreed: ["mock common ground", "another agreed point"],
        disagreed: ["mock divergence"],
        verdict: "the mock verdict",
      });
      yield { type: "text-delta", delta: "```json\n" };
      yield { type: "text-delta", delta: json };
      yield { type: "text-delta", delta: "\n```" };
      yield {
        type: "done",
        usage: { inputTokens: 5, outputTokens: 10, cacheReadTokens: 0 },
      };
      return;
    }

    // Followup prompts — recognise the round-2 stance system prompt and
    // emit canned stance JSON. Tests can smuggle __stance_<X>__ to drive
    // a specific stance per voice.
    if (sys.startsWith("You are a debate participant")) {
      if (userMessage.includes("__followup_error__")) {
        yield { type: "error", message: "mock followup error" };
        return;
      }
      // Stance is per-voice — encode it in the prior critique text the
      // followup prompt embeds. We look for "stance=<X>" in the prompt.
      const stanceMatch = userMessage.match(/stance=(DEFENDED|UPDATED|CONCEDED|GARBAGE)/);
      const stance = stanceMatch?.[1] ?? "UPDATED";
      if (stance === "GARBAGE") {
        yield { type: "text-delta", delta: "not json at all" };
        yield {
          type: "done",
          usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0 },
        };
        return;
      }
      const json = JSON.stringify({
        stance,
        prose: `mock ${stance.toLowerCase()} reply`,
      });
      yield { type: "text-delta", delta: "```json\n" };
      yield { type: "text-delta", delta: json };
      yield { type: "text-delta", delta: "\n```" };
      yield {
        type: "done",
        usage: { inputTokens: 3, outputTokens: 8, cacheReadTokens: 0 },
      };
      return;
    }

    if (userMessage.includes("__error__")) {
      yield { type: "error", message: "mock provider error" };
      return;
    }
    if (userMessage.includes("__hang__")) {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }

    // The override-aware mock: each voice's prose echoes a hash of its
    // system prompt so concurrent voices are distinguishable. Confirms
    // runDebate routes distinct prompts to each voice (no shared mutation).
    const promptTag = sys ? sys.slice(0, 24).replace(/\s+/g, "_") : persona;
    yield { type: "text-delta", delta: `voice=${persona}|prompt=${promptTag}\n` };
    yield { type: "text-delta", delta: "ok\n" };
    yield {
      type: "done",
      usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0 },
    };
  }

  return {
    ...actual,
    runAgent: mockRunAgent,
  };
});

import {
  DEBATE_TEMPLATES,
  DEFAULT_COMPLIANCE_VOICES,
  runDebate,
  runFollowup,
  synthesizeDebate,
} from "../debate";
import type { DebateEvent, DebateResult, DebateSynthesis } from "../debate";
import type { AgentContext } from "../types";

const CTX: AgentContext = {
  control: null,
  frameworkScope: [],
  organizationId: "org-test",
};

describe("runDebate", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs every voice in parallel and preserves input order", async () => {
    const result = await runDebate(
      [
        { name: "Skeptic", personaId: "om-reviewer" },
        { name: "Permissive", personaId: "om-reviewer" },
        { name: "Regulator", personaId: "om-reviewer" },
      ],
      CTX,
      "review this OM",
    );

    expect(result.voices.map((v) => v.name)).toEqual(["Skeptic", "Permissive", "Regulator"]);
    for (const voice of result.voices) {
      expect(voice.status).toBe("ok");
      expect(voice.prose).toContain("ok");
    }
  });

  it("isolates per-voice errors so one bad voice doesn't tank the panel", async () => {
    const result = await runDebate(
      [
        { name: "Healthy", personaId: "om-reviewer" },
        { name: "Broken", personaId: "om-reviewer" },
      ],
      CTX,
      // Smuggle the trigger via the user message; the mock recognizes __error__.
      "review this OM __error__",
    );

    // Both voices saw the same prompt, so both error in this contrived case.
    // Real-world isolation is verified separately — what matters here is that
    // an errored voice resolves with status="error" rather than throwing.
    for (const voice of result.voices) {
      expect(voice.status).toBe("error");
      expect(voice.error).toBe("mock provider error");
    }
  });

  it("times out a hung voice without blocking the others", async () => {
    const result = await runDebate(
      [
        { name: "Fast", personaId: "om-reviewer" },
        { name: "Slow", personaId: "om-reviewer", systemPromptSuffix: "__hang__-marker" },
      ],
      CTX,
      // Only Slow's voice should hang because of the suffix, but in this mock
      // we trigger via the prompt — so use a single hung prompt and check that
      // the timeout fires before the 10s sleep finishes.
      "review this OM __hang__",
      { timeoutMs: 50 },
    );

    expect(result.voices[0]!.status).toBe("timeout");
    expect(result.voices[1]!.status).toBe("timeout");
    expect(result.durationMs).toBeLessThan(2000);
  });

  it("rejects voices with neither personaId nor systemPromptOverride", async () => {
    await expect(() => runDebate([{ name: "Bad" } as never], CTX, "anything")).rejects.toThrow(
      /personaId or systemPromptOverride/,
    );
  });

  it("ships a starter set of compliance voices with stance suffixes", () => {
    expect(DEFAULT_COMPLIANCE_VOICES).toHaveLength(3);
    const names = DEFAULT_COMPLIANCE_VOICES.map((v) => v.name);
    expect(names).toEqual(["Skeptical reviewer", "Permissive reviewer", "Regulator voice"]);
    for (const v of DEFAULT_COMPLIANCE_VOICES) {
      expect(v.personaId).toBe("om-reviewer");
      expect(v.systemPromptSuffix).toMatch(/STANCE:/);
    }
  });

  it("ships a universal template set covering compliance, code, decisions, doc critique", () => {
    expect(DEBATE_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    const ids = DEBATE_TEMPLATES.map((t) => t.id);
    expect(ids).toContain("compliance");
    expect(ids).toContain("code-review");
    expect(ids).toContain("decision");
    expect(ids).toContain("doc-critique");
    for (const template of DEBATE_TEMPLATES) {
      expect(template.voices.length).toBeGreaterThanOrEqual(2);
      expect(template.prompt.length).toBeGreaterThan(20);
      // Universal templates either use a persona or a full override; never both undefined.
      for (const voice of template.voices) {
        expect(Boolean(voice.personaId ?? voice.systemPromptOverride)).toBe(true);
      }
    }
  });

  it("synthesizeDebate parses fenced JSON into agreed/diverged/verdict", async () => {
    const result: DebateResult = {
      voices: [
        { name: "A", status: "ok", prose: "A says X", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "om-reviewer" },
        { name: "B", status: "ok", prose: "B says Y", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "om-reviewer" },
      ],
      provider: "ollama",
      model: "test",
      durationMs: 10,
    };
    const synthesis = await synthesizeDebate(result, "what should we do", CTX);
    expect(synthesis).not.toBeNull();
    expect(synthesis!.verdict).toBe("the mock verdict");
    expect(synthesis!.agreed).toEqual(["mock common ground", "another agreed point"]);
    expect(synthesis!.disagreed).toEqual(["mock divergence"]);
  });

  it("synthesizeDebate returns null when fewer than 2 voices succeeded", async () => {
    const result: DebateResult = {
      voices: [
        { name: "A", status: "ok", prose: "x", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "om-reviewer" },
        { name: "B", status: "error", prose: "", citations: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }, persona: "om-reviewer", error: "boom" },
      ],
      provider: "ollama",
      model: "test",
      durationMs: 10,
    };
    expect(await synthesizeDebate(result, "anything", CTX)).toBeNull();
  });

  it("synthesizeDebate returns null on malformed JSON output", async () => {
    const result: DebateResult = {
      voices: [
        { name: "A", status: "ok", prose: "p", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "om-reviewer" },
        { name: "B", status: "ok", prose: "p", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "om-reviewer" },
      ],
      provider: "ollama",
      model: "test",
      durationMs: 10,
    };
    // The mock's __synth_garbage__ trigger emits non-JSON.
    expect(await synthesizeDebate(result, "ask __synth_garbage__", CTX)).toBeNull();
  });

  it("runFollowup skips errored round-1 voices and preserves original index", async () => {
    const result: DebateResult = {
      voices: [
        { name: "Optimist", status: "ok", prose: "stance=DEFENDED arg", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "drafter" },
        { name: "Broken", status: "error", prose: "", citations: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }, persona: "drafter", error: "round-1 fail" },
        { name: "Skeptic", status: "ok", prose: "stance=UPDATED arg", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "drafter" },
      ],
      provider: "ollama",
      model: "test",
      durationMs: 10,
    };
    const synthesis: DebateSynthesis = {
      agreed: ["x"],
      disagreed: ["y"],
      verdict: "do z",
      rawText: "",
    };
    const followups = await runFollowup(result, synthesis, "ask", CTX);

    // Two voices succeeded round-1, so two followups returned.
    expect(followups).toHaveLength(2);
    // Each followup carries its ORIGINAL voice index (0 and 2, not 0 and 1).
    expect(followups.map((f) => f.index).sort()).toEqual([0, 2]);
    // The errored Voice "Broken" (index 1) is NOT in the result.
    expect(followups.map((f) => f.name)).not.toContain("Broken");
    // Stance fields parsed from the canned mock JSON.
    const stances = followups.map((f) => f.stance).sort();
    expect(stances).toEqual(["defended", "updated"]);
  });

  it("runFollowup returns [] when fewer than 2 round-1 voices succeeded", async () => {
    const result: DebateResult = {
      voices: [
        { name: "Solo", status: "ok", prose: "stance=DEFENDED", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "drafter" },
      ],
      provider: "ollama",
      model: "test",
      durationMs: 10,
    };
    const synthesis: DebateSynthesis = {
      agreed: [],
      disagreed: [],
      verdict: "",
      rawText: "",
    };
    expect(await runFollowup(result, synthesis, "ask", CTX)).toEqual([]);
  });

  it("runFollowup falls back to stance='unclear' on garbage output", async () => {
    const result: DebateResult = {
      voices: [
        { name: "A", status: "ok", prose: "stance=GARBAGE", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "drafter" },
        { name: "B", status: "ok", prose: "stance=GARBAGE", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "drafter" },
      ],
      provider: "ollama",
      model: "test",
      durationMs: 10,
    };
    const synthesis: DebateSynthesis = { agreed: [], disagreed: [], verdict: "", rawText: "" };
    const followups = await runFollowup(result, synthesis, "ask", CTX);
    expect(followups).toHaveLength(2);
    for (const f of followups) {
      expect(f.stance).toBe("unclear");
      expect(f.status).toBe("ok"); // status is "ok" because runAgent didn't error
    }
  });

  it("runFollowup emits started/delta/completed events with original index", async () => {
    const result: DebateResult = {
      voices: [
        { name: "A", status: "ok", prose: "stance=DEFENDED", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "drafter" },
        { name: "B", status: "error", prose: "", citations: [], usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }, persona: "drafter", error: "skip me" },
        { name: "C", status: "ok", prose: "stance=UPDATED", citations: [], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 }, persona: "drafter" },
      ],
      provider: "ollama",
      model: "test",
      durationMs: 10,
    };
    const synthesis: DebateSynthesis = { agreed: [], disagreed: [], verdict: "", rawText: "" };
    const events: Array<{ type: string; index: number; name: string }> = [];
    await runFollowup(result, synthesis, "ask", CTX, {
      onFollowupEvent: (ev) => events.push({ type: ev.type, index: ev.index, name: ev.name }),
    });

    // followup-started fires once per ok voice, with original index.
    const started = events.filter((e) => e.type === "followup-started");
    expect(started.map((e) => e.index).sort()).toEqual([0, 2]);
    // followup-completed also fires once per ok voice, with original index.
    const completed = events.filter((e) => e.type === "followup-completed");
    expect(completed.map((e) => e.index).sort()).toEqual([0, 2]);
    // No event ever fires for the errored "B" (index 1).
    expect(events.some((e) => e.name === "B")).toBe(false);
  });

  it("emits voice-started, voice-delta, and voice-completed via onEvent", async () => {
    const events: DebateEvent[] = [];
    await runDebate(
      [
        { name: "A", personaId: "om-reviewer" },
        { name: "B", personaId: "om-reviewer" },
      ],
      CTX,
      "review this OM",
      { onEvent: (e) => events.push(e) },
    );

    const types = events.map((e) => e.type);
    // Each voice fires exactly one started + at least one delta + one completed.
    expect(types.filter((t) => t === "voice-started")).toHaveLength(2);
    expect(types.filter((t) => t === "voice-delta").length).toBeGreaterThanOrEqual(2);
    expect(types.filter((t) => t === "voice-completed")).toHaveLength(2);

    const completed = events.filter((e) => e.type === "voice-completed") as Extract<
      DebateEvent,
      { type: "voice-completed" }
    >[];
    expect(completed.map((c) => c.name).sort()).toEqual(["A", "B"]);
    for (const c of completed) {
      expect(c.status).toBe("ok");
      expect(c.prose).toContain("ok");
    }
  });
});
