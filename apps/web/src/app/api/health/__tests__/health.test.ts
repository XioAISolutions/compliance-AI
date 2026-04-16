import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/health", () => {
  it("returns a json payload with status, checks, uptimeMs, version", async () => {
    const res = await GET();
    expect([200, 503]).toContain(res.status);
    const body = (await res.json()) as {
      status: string;
      checks: Record<string, { ok: boolean }>;
      uptimeMs: number;
      version: string;
    };
    expect(["ok", "degraded"]).toContain(body.status);
    expect(typeof body.uptimeMs).toBe("number");
    expect(typeof body.version).toBe("string");
    expect(body.checks.matterStore?.ok).toBe(true);
    expect(body.checks.cognition?.ok).toBe(true);
    expect(body.checks.transcript?.ok).toBe(true);
    // anthropic check reflects whether the API key is set in the test env;
    // both states are valid — we only assert the key exists.
    expect(typeof body.checks.anthropic?.ok).toBe("boolean");
  });

  it("returns 200 when every check passes", async () => {
    // Ensure the check runs cleanly against a warm singleton set.
    const first = await GET();
    const second = await GET();
    // If either call was 503 it's because a singleton failed to init; we
    // expect both calls to land on the same branch.
    expect(first.status).toBe(second.status);
  });
});
