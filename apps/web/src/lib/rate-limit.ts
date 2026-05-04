/**
 * In-memory token-bucket rate limiter.
 *
 * Designed to keep a public hackathon demo URL from draining the $100 AMD
 * Cloud credit (or any other inference budget) when a single client gets
 * curious — or hostile. Lives in-process, so each Railway instance has its
 * own bucket; that's fine for a 1-replica preview, and the cost ceiling is
 * still N × bucket × providerCost which is bounded.
 *
 * Usage:
 *   const { allowed, retryAfterSec } = consumeToken(bucketId);
 *   if (!allowed) return new Response("Too Many Requests", { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
 *
 * The bucket is keyed by client identity (IP from x-forwarded-for, or
 * "anon" if absent). Capacity + refill rate are configurable per route via
 * env vars so we can tune without redeploying.
 */

interface Bucket {
  /** Floating-point token count, refilled at `refillPerSec` per second. */
  tokens: number;
  /** Last time we refilled, ms epoch. */
  updatedAt: number;
}

const BUCKETS = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Maximum tokens the bucket can hold. */
  capacity: number;
  /** How fast tokens refill, per second. capacity/refillPerSec = full-refill window. */
  refillPerSec: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
  /** Tokens remaining after the (attempted) consume. */
  remaining: number;
}

/**
 * Consume one token from the bucket for the given key. Returns whether the
 * request should proceed. When denied, retryAfterSec tells the client when
 * the next token becomes available.
 */
export function consumeToken(key: string, config: RateLimitConfig): RateLimitDecision {
  const now = Date.now();
  const existing = BUCKETS.get(key);
  const bucket: Bucket = existing ?? { tokens: config.capacity, updatedAt: now };

  // Refill since last update.
  if (existing) {
    const elapsedSec = (now - existing.updatedAt) / 1000;
    bucket.tokens = Math.min(config.capacity, existing.tokens + elapsedSec * config.refillPerSec);
    bucket.updatedAt = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    BUCKETS.set(key, bucket);
    return { allowed: true, retryAfterSec: 0, remaining: Math.floor(bucket.tokens) };
  }

  // Denied. Compute how long until the next token refills.
  const tokensShort = 1 - bucket.tokens;
  const retryAfterSec = Math.max(1, Math.ceil(tokensShort / config.refillPerSec));
  BUCKETS.set(key, bucket);
  return { allowed: false, retryAfterSec, remaining: Math.floor(bucket.tokens) };
}

/**
 * Best-effort client identity for rate-limit keying.
 *
 * Order: x-forwarded-for first (Railway puts the real client there), then
 * Vercel/Cloudflare-style headers, then a literal "anon" fallback when none
 * are present (e.g. running locally over loopback).
 */
export function clientIdFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const cfip = req.headers.get("cf-connecting-ip");
  if (cfip) return cfip.trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anon";
}

/**
 * Read a rate-limit config from env vars with a default fallback.
 * Format: `<capacity>:<refillPerSec>`, e.g. "10:0.1" = 10 burst, 1 every 10s.
 */
export function readConfigFromEnv(envVar: string, fallback: RateLimitConfig): RateLimitConfig {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const match = raw.match(/^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/);
  if (!match) return fallback;
  const capacity = Number(match[1]);
  const refillPerSec = Number(match[2]);
  if (!Number.isFinite(capacity) || !Number.isFinite(refillPerSec)) return fallback;
  if (capacity <= 0 || refillPerSec <= 0) return fallback;
  return { capacity, refillPerSec };
}

/**
 * Test-only — clear in-memory buckets between unit tests so cases don't bleed.
 */
export function _resetForTests(): void {
  BUCKETS.clear();
}
