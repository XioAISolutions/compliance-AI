/**
 * Lesson layer singleton — wires the in-memory store, sidecar, garden,
 * scheduler, resource calculator, and metrics for the web app.
 *
 * Per-process singleton; production would scope these per-tenant via
 * the same factory pattern as approvals-store / matter-store.
 */

import {
  CognitionGarden,
  CognitionSidecar,
  DeterministicEmbedder,
  FileBackedWakeQueue,
  GardenScheduler,
  InMemoryLessonStore,
  InMemoryMetrics,
  InMemoryWakeQueue,
  ResourceCalculator,
  defaultEmbedder,
  type Embedder,
  type WakeQueue,
} from "@compliance-ai/cognition";

interface LessonsBundle {
  store: InMemoryLessonStore;
  embedder: Embedder;
  sidecar: CognitionSidecar;
  garden: CognitionGarden;
  scheduler: GardenScheduler;
  resources: ResourceCalculator;
  metrics: InMemoryMetrics;
  queue: WakeQueue;
}

let _bundle: LessonsBundle | null = null;

export function getLessonsBundle(): LessonsBundle {
  if (_bundle) return _bundle;

  const store = new InMemoryLessonStore();
  // Default to deterministic on the server unless OPENAI_API_KEY is
  // present — keeps Railway preview deploys offline-clean.
  const embedder =
    process.env.OPENAI_API_KEY && process.env.COGNITION_EMBEDDER !== "deterministic"
      ? defaultEmbedder()
      : new DeterministicEmbedder();
  const metrics = new InMemoryMetrics();
  const sidecar = new CognitionSidecar(store, embedder, {
    similarityThreshold: 0.78,
    metrics,
  });
  const resources = new ResourceCalculator({
    tokensPerHour: 200_000,
    ambientTokenCapPerCycle: 8_000,
    rateLimitMargin: 0.1,
  });
  const garden = new CognitionGarden(store, embedder, sidecar, resources, metrics, {
    similarityThreshold: 0.9,
  });

  // Wake queue: persist if WAKE_QUEUE_PATH is set (Railway disk is
  // ephemeral, so we only opt in when an operator points us at a
  // mounted volume); otherwise in-memory so the process owns it.
  const queue: WakeQueue = process.env.WAKE_QUEUE_PATH
    ? new FileBackedWakeQueue(process.env.WAKE_QUEUE_PATH)
    : new InMemoryWakeQueue();
  const scheduler = new GardenScheduler(garden, queue, {
    timerIntervalMs: 15 * 60 * 1000,
  });

  _bundle = { store, embedder, sidecar, garden, scheduler, resources, metrics, queue };
  return _bundle;
}

/** Reset for tests. */
export function resetLessonsBundle(): void {
  _bundle?.scheduler.stop();
  _bundle = null;
}

/**
 * Extract lesson candidates from a matter context bundle and run them
 * through the sidecar. This is our "CRUMB receive" hook — the matter
 * bundle plays the role of an inter-agent handoff payload (the
 * authoritative end-of-session snapshot for one matter), and the
 * sidecar consolidation runs after that snapshot is committed.
 *
 * Sources of candidates:
 *   - Judge rationale entries in the audit log (failures + retries are
 *     where the firm actually learns).
 *   - Evidence gaps tagged "missing" or "stale" (each becomes a
 *     "remember to collect X" lesson).
 *
 * Errors here are swallowed — consolidation is advisory; we never let
 * a bad lesson candidate blow up an export or approval flow.
 */
export async function consolidateMatterLessons(
  matterId: string,
  sessionId: string,
): Promise<{ processed: number; actions: Record<string, number> }> {
  const { sidecar } = getLessonsBundle();
  // Lazy import to avoid pulling matter-context into every caller.
  const { buildMatterContextBundle } = await import("./matter-context");
  const bundle = await buildMatterContextBundle(matterId);
  if (!bundle) return { processed: 0, actions: {} };

  const orgId = bundle.matter.organizationId;
  const observedAt = new Date();
  const actions: Record<string, number> = { inserted: 0, reinforced: 0, superseded: 0 };
  let processed = 0;

  // Judge rationale — every "verdict" audit entry where the judge
  // explained why the draft wasn't ready becomes a candidate.
  for (const entry of bundle.audit) {
    if (entry.action !== "verdict") continue;
    if (!entry.judgeVerdict || entry.judgeVerdict === "READY_TO_SUBMIT") continue;
    const rationale = (entry.inputContent ?? entry.outputContent ?? "").trim();
    if (rationale.length < 24) continue;
    try {
      const result = await sidecar.consolidate({
        organizationId: orgId,
        content: rationale.slice(0, 1024),
        source: { sessionId, agent: "judge", observedAt },
        tags: ["judge-rationale", `verdict:${entry.judgeVerdict}`],
      });
      actions[result.action] = (actions[result.action] ?? 0) + 1;
      processed++;
    } catch {
      // Advisory only.
    }
  }

  // Evidence gaps — each missing item teaches "remember to collect X".
  for (const item of bundle.evidence) {
    if (item.status !== "missing" && item.status !== "stale") continue;
    const content = `Evidence gap: ${item.title}${item.source ? ` (source: ${item.source})` : ""}.`;
    try {
      const result = await sidecar.consolidate({
        organizationId: orgId,
        content,
        source: { sessionId, agent: "evidence-collector", observedAt },
        tags: ["evidence-gap", `status:${item.status}`],
      });
      actions[result.action] = (actions[result.action] ?? 0) + 1;
      processed++;
    } catch {
      // Advisory only.
    }
  }

  return { processed, actions };
}
