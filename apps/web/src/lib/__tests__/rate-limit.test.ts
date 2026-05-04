import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetForTests,
  clientIdFromRequest,
  consumeToken,
  readConfigFromEnv,
} from "../rate-limit";

describe("consumeToken (token bucket)", () => {
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to `capacity` requests in a burst, then denies", () => {
    const cfg = { capacity: 3, refillPerSec: 0.5 };
    expect(consumeToken("k", cfg).allowed).toBe(true);
    expect(consumeToken("k", cfg).allowed).toBe(true);
    expect(consumeToken("k", cfg).allowed).toBe(true);
    const denied = consumeToken("k", cfg);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });

  it("refills tokens over time at refillPerSec", () => {
    const cfg = { capacity: 2, refillPerSec: 1 }; // 1 token per second
    consumeToken("k", cfg);
    consumeToken("k", cfg);
    expect(consumeToken("k", cfg).allowed).toBe(false);
    // Advance by 2 seconds — refills 2 tokens (capped at capacity=2).
    vi.advanceTimersByTime(2_000);
    expect(consumeToken("k", cfg).allowed).toBe(true);
    expect(consumeToken("k", cfg).allowed).toBe(true);
    expect(consumeToken("k", cfg).allowed).toBe(false);
  });

  it("isolates buckets by key", () => {
    const cfg = { capacity: 1, refillPerSec: 0.1 };
    expect(consumeToken("client-a", cfg).allowed).toBe(true);
    expect(consumeToken("client-b", cfg).allowed).toBe(true);
    expect(consumeToken("client-a", cfg).allowed).toBe(false);
    expect(consumeToken("client-b", cfg).allowed).toBe(false);
  });

  it("denies report a Retry-After in seconds, ≥1", () => {
    const cfg = { capacity: 1, refillPerSec: 0.1 }; // 1 token / 10s
    consumeToken("k", cfg);
    const denied = consumeToken("k", cfg);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    // Should be ≤ ceil(1 / 0.1) = 10
    expect(denied.retryAfterSec).toBeLessThanOrEqual(10);
  });
});

describe("clientIdFromRequest", () => {
  it("prefers x-forwarded-for first hop", () => {
    const req = new Request("http://example.test/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(clientIdFromRequest(req)).toBe("203.0.113.5");
  });

  it("falls back to cf-connecting-ip then x-real-ip", () => {
    const cf = new Request("http://example.test/", {
      headers: { "cf-connecting-ip": "203.0.113.6" },
    });
    expect(clientIdFromRequest(cf)).toBe("203.0.113.6");
    const real = new Request("http://example.test/", {
      headers: { "x-real-ip": "203.0.113.7" },
    });
    expect(clientIdFromRequest(real)).toBe("203.0.113.7");
  });

  it("returns 'anon' when no client headers are present", () => {
    expect(clientIdFromRequest(new Request("http://example.test/"))).toBe("anon");
  });
});

describe("readConfigFromEnv", () => {
  beforeEach(() => {
    delete process.env.TEST_RL_VAR;
  });

  it("returns fallback when env is unset", () => {
    expect(readConfigFromEnv("TEST_RL_VAR", { capacity: 10, refillPerSec: 1 })).toEqual({
      capacity: 10,
      refillPerSec: 1,
    });
  });

  it("parses 'capacity:refillPerSec' format", () => {
    process.env.TEST_RL_VAR = "5:0.25";
    expect(readConfigFromEnv("TEST_RL_VAR", { capacity: 1, refillPerSec: 1 })).toEqual({
      capacity: 5,
      refillPerSec: 0.25,
    });
  });

  it("falls back on malformed input", () => {
    process.env.TEST_RL_VAR = "not-a-config";
    expect(readConfigFromEnv("TEST_RL_VAR", { capacity: 7, refillPerSec: 0.7 })).toEqual({
      capacity: 7,
      refillPerSec: 0.7,
    });
  });
});
