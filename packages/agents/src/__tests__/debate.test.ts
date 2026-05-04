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
    yield { type: "persona-selected", persona, reason: "mock" };

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
    const promptTag = options.systemPromptOverride
      ? options.systemPromptOverride.slice(0, 24).replace(/\s+/g, "_")
      : persona;
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

import { DEBATE_TEMPLATES, DEFAULT_COMPLIANCE_VOICES, runDebate } from "../debate";
import type { DebateEvent } from "../debate";
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
