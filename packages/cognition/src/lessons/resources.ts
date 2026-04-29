/**
 * Resource calculator — gates ambient garden cycles against provider
 * rate limits, a rolling token usage window, and live-agent activity.
 *
 * The contract: a garden cycle MUST call `canStartCycle(estimate)`
 * before doing real work, and MUST call `recordTokens()` afterwards.
 * The scheduler refuses to wake a garden if `canStartCycle` returns
 * `{ ok: false }`.
 *
 * Two protections are non-negotiable:
 *   1. Hard per-cycle budget cap (`ambientTokenCapPerCycle`) so a
 *      runaway cycle can't drain the org's daily allowance.
 *   2. Live-agents-active flag — never starve a live debate.
 */

const ROLLING_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface TokenSample {
  timestamp: number;
  tokens: number;
}

interface RateLimitState {
  remaining: number;
  total: number;
  resetAtMs: number;
}

export interface ResourceBudget {
  /** Cap on tokens consumed within ROLLING_WINDOW_MS. */
  tokensPerHour: number;
  /** Hard cap a single cycle is allowed to spend. */
  ambientTokenCapPerCycle: number;
  /**
   * Fraction of remaining rate-limit headroom required (0..1).
   * 0.2 means "refuse if less than 20% of total quota is left."
   */
  rateLimitMargin: number;
}

export interface CycleVerdict {
  ok: boolean;
  reason?: string;
}

export class ResourceCalculator {
  private samples: TokenSample[] = [];
  private rateLimits = new Map<string, RateLimitState>();
  private liveAgents = 0;
  private now: () => number;

  constructor(
    private readonly budget: ResourceBudget,
    options: { now?: () => number } = {},
  ) {
    this.now = options.now ?? (() => Date.now());
  }

  recordTokens(_provider: string, count: number): void {
    this.samples.push({ timestamp: this.now(), tokens: count });
    this.gc();
  }

  recordRateLimitHeaders(
    provider: string,
    remaining: number,
    total: number,
    resetAtMs: number,
  ): void {
    this.rateLimits.set(provider, { remaining, total, resetAtMs });
  }

  beginLiveAgent(): void {
    this.liveAgents++;
  }

  endLiveAgent(): void {
    this.liveAgents = Math.max(0, this.liveAgents - 1);
  }

  isLiveAgentActive(): boolean {
    return this.liveAgents > 0;
  }

  /**
   * Decide whether a garden cycle expecting `estimatedTokens` may run.
   * The estimate is the cycle's pre-flight guess (e.g., topK lessons *
   * model context + per-call overhead). Conservative is fine.
   */
  canStartCycle(estimatedTokens: number): CycleVerdict {
    if (this.liveAgents > 0) {
      return { ok: false, reason: "live agent debate in progress" };
    }
    if (estimatedTokens > this.budget.ambientTokenCapPerCycle) {
      return {
        ok: false,
        reason: `cycle estimate ${estimatedTokens} exceeds per-cycle cap ${this.budget.ambientTokenCapPerCycle}`,
      };
    }
    const used = this.tokensInWindow();
    if (used + estimatedTokens > this.budget.tokensPerHour) {
      return {
        ok: false,
        reason: `would exceed hourly budget (${used} + ${estimatedTokens} > ${this.budget.tokensPerHour})`,
      };
    }
    for (const [provider, state] of this.rateLimits) {
      const margin = state.remaining / state.total;
      if (margin < this.budget.rateLimitMargin) {
        return {
          ok: false,
          reason: `provider ${provider} below rate-limit margin (${margin.toFixed(2)} < ${this.budget.rateLimitMargin})`,
        };
      }
    }
    return { ok: true };
  }

  tokensInWindow(): number {
    this.gc();
    let sum = 0;
    for (const s of this.samples) sum += s.tokens;
    return sum;
  }

  private gc(): void {
    const cutoff = this.now() - ROLLING_WINDOW_MS;
    if (this.samples.length === 0) return;
    let i = 0;
    while (i < this.samples.length && this.samples[i]!.timestamp < cutoff) i++;
    if (i > 0) this.samples = this.samples.slice(i);
  }
}
