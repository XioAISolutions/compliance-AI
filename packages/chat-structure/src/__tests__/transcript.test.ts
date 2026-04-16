import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTranscriptStore } from "../transcript";

describe("InMemoryTranscriptStore", () => {
  let store: InMemoryTranscriptStore;

  beforeEach(() => {
    store = new InMemoryTranscriptStore();
  });

  it("appends turns with monotonic per-matter seq", () => {
    const a = store.append({
      matterId: "m1",
      from: "user",
      content: "Hi",
      kind: "user-message",
    });
    const b = store.append({
      matterId: "m1",
      from: "drafter",
      content: "Hello",
      kind: "agent-draft",
      round: 1,
    });
    const c = store.append({
      matterId: "m2",
      from: "user",
      content: "Different matter",
      kind: "user-message",
    });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(c.seq).toBe(1); // separate counter for m2
  });

  it("assigns createdAt + uuid when not supplied", () => {
    const turn = store.append({
      matterId: "m1",
      from: "user",
      content: "hi",
      kind: "user-message",
    });
    expect(turn.id).toBeTruthy();
    expect(() => new Date(turn.createdAt)).not.toThrow();
  });

  it("returns turns sorted by seq", () => {
    store.append({ matterId: "m1", from: "user", content: "1", kind: "user-message" });
    store.append({ matterId: "m1", from: "drafter", content: "2", kind: "agent-draft" });
    store.append({ matterId: "m1", from: "judge", content: "3", kind: "judge-verdict" });
    const list = store.getByMatter("m1");
    expect(list.map((t) => t.content)).toEqual(["1", "2", "3"]);
  });

  it("produces JSONL one-turn-per-line", () => {
    store.append({ matterId: "m1", from: "user", content: "hi", kind: "user-message" });
    store.append({
      matterId: "m1",
      from: "drafter",
      content: "draft",
      kind: "agent-draft",
      round: 1,
    });
    const jsonl = store.toJsonl("m1");
    const lines = jsonl.split("\n");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("clears a specific matter without touching others", () => {
    store.append({ matterId: "m1", from: "user", content: "a", kind: "user-message" });
    store.append({ matterId: "m2", from: "user", content: "b", kind: "user-message" });
    store.clear("m1");
    expect(store.getByMatter("m1")).toHaveLength(0);
    expect(store.getByMatter("m2")).toHaveLength(1);
  });

  it("clear() with no argument wipes everything", () => {
    store.append({ matterId: "m1", from: "user", content: "a", kind: "user-message" });
    store.append({ matterId: "m2", from: "user", content: "b", kind: "user-message" });
    store.clear();
    expect(store.getByMatter("m1")).toHaveLength(0);
    expect(store.getByMatter("m2")).toHaveLength(0);
  });
});
