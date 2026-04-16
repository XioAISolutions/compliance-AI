import { describe, it, expect } from "vitest";
import { PARTICIPANTS, getParticipant, isParticipantId, toStatusView } from "../registry";

describe("registry", () => {
  it("registers every known participant id", () => {
    const ids = Object.keys(PARTICIPANTS);
    // Sanity: at least the user + 9 persona agents.
    expect(ids.length).toBeGreaterThanOrEqual(10);
  });

  it("each participant has a distinct color (at most one participant per color)", () => {
    // Colors should be distinct so timeline pills are unambiguous.
    const colors = Object.values(PARTICIPANTS).map((p) => p.color);
    const duplicates = colors.filter((c, i) => colors.indexOf(c) !== i);
    expect(duplicates).toEqual([]);
  });

  it("isParticipantId rejects unknown ids", () => {
    expect(isParticipantId("drafter")).toBe(true);
    expect(isParticipantId("user")).toBe(true);
    expect(isParticipantId("nobody")).toBe(false);
    expect(isParticipantId("")).toBe(false);
  });

  it("getParticipant returns the canonical record", () => {
    const p = getParticipant("judge");
    expect(p.id).toBe("judge");
    expect(p.name).toBe("Judge");
    expect(p.color).toBe("amber");
  });

  it("toStatusView defaults user offline + agents online", () => {
    const view = toStatusView();
    const user = view.find((v) => v.id === "user");
    const judge = view.find((v) => v.id === "judge");
    expect(user?.status).toBe("offline");
    expect(judge?.status).toBe("online");
  });

  it("toStatusView honors explicit status overrides", () => {
    const view = toStatusView({ drafter: "working" });
    const drafter = view.find((v) => v.id === "drafter");
    expect(drafter?.status).toBe("working");
  });
});
