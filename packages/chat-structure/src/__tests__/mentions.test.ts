import { describe, it, expect } from "vitest";
import {
  parseMentions,
  createLoopGuard,
  guardBumpAgentHop,
  guardResetOnUserTurn,
  describeMention,
} from "../mentions";

describe("parseMentions", () => {
  it("extracts known mentions", () => {
    const result = parseMentions("Hey @drafter can you ping @judge after this?");
    expect(result.mentions).toEqual(expect.arrayContaining(["drafter", "judge"]));
    expect(result.mentions).toHaveLength(2);
  });

  it("ignores unknown mentions but surfaces them", () => {
    const result = parseMentions("@nonperson please advise");
    expect(result.mentions).toHaveLength(0);
    expect(result.unknownMentions).toContain("nonperson");
  });

  it("dedupes repeated mentions", () => {
    const result = parseMentions("@drafter hi @drafter once more");
    expect(result.mentions).toEqual(["drafter"]);
  });

  it("strips @mentions from cleaned text", () => {
    const result = parseMentions("@drafter please @judge this");
    expect(result.cleaned).not.toContain("@drafter");
    expect(result.cleaned).not.toContain("@judge");
    expect(result.cleaned).toBe("please this");
  });

  it("preserves raw text verbatim", () => {
    const text = "@kyc-reviewer should @drafter cover FINTRAC identity?";
    const result = parseMentions(text);
    expect(result.raw).toBe(text);
  });

  it("handles mentions at the very start of the string", () => {
    const result = parseMentions("@risk-assessor what's the exposure?");
    expect(result.mentions).toEqual(["risk-assessor"]);
  });
});

describe("loop guard", () => {
  it("starts with hopsUsed=0", () => {
    const guard = createLoopGuard(4);
    expect(guard.hopsUsed).toBe(0);
    expect(guard.maxHops).toBe(4);
  });

  it("pauses when hops equal maxHops", () => {
    const guard = createLoopGuard(2);
    expect(guardBumpAgentHop(guard).paused).toBe(false);
    const second = guardBumpAgentHop(guard);
    expect(second.paused).toBe(true);
  });

  it("resets on user turn", () => {
    const guard = createLoopGuard(2);
    guardBumpAgentHop(guard);
    guardBumpAgentHop(guard);
    guardResetOnUserTurn(guard);
    expect(guard.hopsUsed).toBe(0);
    expect(guardBumpAgentHop(guard).paused).toBe(false);
  });
});

describe("describeMention", () => {
  it("returns a formatted string with the @id and name", () => {
    const desc = describeMention("drafter");
    expect(desc).toContain("@drafter");
    expect(desc).toContain("Drafter");
  });
});
