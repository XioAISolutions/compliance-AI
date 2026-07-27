/**
 * Garden scheduler.
 *
 * Wakes the garden on triggers:
 *   - session-close   (call notifySessionClose)
 *   - crash-recovery  (call notifyCrashRecovery)
 *   - corpus-commit   (call notifyCorpusCommit — typically wired from
 *                      a git post-receive hook on the rules corpus)
 *   - timer           (configurable interval; emits a "timer" wake)
 *
 * Every notify enqueues a WakeEnvelope to the persistent queue. A
 * single in-flight cycle promise guards against parallel runs (the
 * resource calculator's live-agent check is the second line of
 * defense; this is the first).
 */

import type { CognitionGarden, GardenCycleInput, GardenCycleReport } from "./garden.js";
import type { WakeEnvelope, WakeQueue, WakeTrigger } from "./queue.js";

export interface SchedulerOptions {
  timerIntervalMs?: number;
  /**
   * Optional supplier for crashed-session payloads keyed by org. The
   * scheduler doesn't know how to enumerate these — the caller does.
   */
  crashedSessionsFor?: (
    organizationId: string,
  ) => Promise<NonNullable<GardenCycleInput["crashedSessions"]>>;
  /** Optional supplier for live anchors. */
  liveAnchorsFor?: (
    organizationId: string,
  ) => Promise<NonNullable<GardenCycleInput["liveAnchors"]>>;
  /** For tests — inject a clock. */
  now?: () => number;
}

export class GardenScheduler {
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private readonly timerIntervalMs: number;
  private readonly crashedSessionsFor?: SchedulerOptions["crashedSessionsFor"];
  private readonly liveAnchorsFor?: SchedulerOptions["liveAnchorsFor"];

  constructor(
    private readonly garden: CognitionGarden,
    private readonly queue: WakeQueue,
    options: SchedulerOptions = {},
  ) {
    this.timerIntervalMs = options.timerIntervalMs ?? 15 * 60 * 1000;
    this.crashedSessionsFor = options.crashedSessionsFor;
    this.liveAnchorsFor = options.liveAnchorsFor;
  }

  start(): void {
    if (this.timerHandle) return;
    this.timerHandle = setInterval(() => {
      // Timer wakes are organization-agnostic at the scheduler layer;
      // the drain loop is responsible for picking which orgs to run.
      this.queue.enqueue({
        trigger: "timer",
        organizationId: "*",
      });
      void this.drain().catch(() => {
        // Swallow — the audit log records per-cycle failures.
      });
    }, this.timerIntervalMs);
  }

  stop(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  notifySessionClose(organizationId: string): WakeEnvelope {
    return this.notify("session-close", organizationId);
  }
  notifyCrashRecovery(organizationId: string): WakeEnvelope {
    return this.notify("crash-recovery", organizationId);
  }
  notifyCorpusCommit(organizationId: string, sha?: string): WakeEnvelope {
    return this.notify("corpus-commit", organizationId, sha ? { sha } : undefined);
  }

  private notify(
    trigger: WakeTrigger,
    organizationId: string,
    payload?: Record<string, string>,
  ): WakeEnvelope {
    return this.queue.enqueue(
      payload === undefined
        ? { trigger, organizationId }
        : { trigger, organizationId, payload },
    );
  }

  /**
   * Drain pending wakes into garden cycles, one at a time. Returns
   * the per-wake reports so callers can audit. Skips wakes whose
   * trigger conditions don't apply (e.g., crash-recovery with no
   * crashed-sessions supplier configured).
   */
  async drain(): Promise<GardenCycleReport[]> {
    if (this.inFlight) return [];
    this.inFlight = true;
    const reports: GardenCycleReport[] = [];
    try {
      const pending = this.queue.pending();
      for (const envelope of pending) {
        const report = await this.runWake(envelope);
        if (report) reports.push(report);
        this.queue.dequeue(envelope.id);
      }
    } finally {
      this.inFlight = false;
    }
    return reports;
  }

  private async runWake(env: WakeEnvelope): Promise<GardenCycleReport | null> {
    if (env.organizationId === "*") {
      // Timer wakes don't carry an org; skip — concrete deployments
      // would expand to "all known orgs" from the matter store.
      return null;
    }
    const input: GardenCycleInput = {
      organizationId: env.organizationId,
    };
    if (env.trigger === "crash-recovery" && this.crashedSessionsFor) {
      input.crashedSessions = await this.crashedSessionsFor(env.organizationId);
    }
    if (this.liveAnchorsFor) {
      input.liveAnchors = await this.liveAnchorsFor(env.organizationId);
    }
    return this.garden.runCycle(input);
  }
}
