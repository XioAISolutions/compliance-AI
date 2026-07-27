# Two-Layer Cognition — Migration Notes

This branch lands the lesson-layer subsystem under
`packages/cognition/src/lessons/`. It is **additive** — no existing
write path is removed, no existing test changes assertion semantics.

## What's new

| Component | File | Purpose |
|---|---|---|
| `Lesson`, `LessonRelation`, `LessonSource` | `lessons/types.ts` | Wire types — distinct from `CognitionItem` (authority chunks). |
| `InMemoryLessonStore` | `lessons/in-memory-store.ts` | Default backend; `markSuperseded` and `reinforceWith` keep bandit ids stable. |
| `DeterministicEmbedder`, `OpenAIEmbedder` | `lessons/embedding.ts` | Token-frequency hash embedder for tests; OpenAI for prod. |
| `CognitionSidecar` | `lessons/sidecar.ts` | Layer 1 — reinforce / supersede / insert per turn. |
| `detectContradiction` | `lessons/contradiction.ts` | Negation + numeric-threshold heuristic. |
| `CognitionGarden` | `lessons/garden.ts` | Layer 2 — dedup, anchor verification, retroactive extraction, relation discovery. |
| `GardenScheduler`, `FileBackedWakeQueue` | `lessons/scheduler.ts`, `lessons/queue.ts` | Trigger-based wakes + persistent queue. |
| `ResourceCalculator` | `lessons/resources.ts` | Token window + rate-limit + live-agent gate. |
| `pickAmbientProvider` | `lessons/provider.ts` | API-key cascade (Ollama → Anthropic Haiku → OpenAI mini). |
| `parseCrumbToCandidates` | `lessons/crumb.ts` | YAML-ish CRUMB block → lesson candidates. |
| `InMemoryMetrics` | `lessons/metrics.ts` | Reinforced/inserted/superseded counters + ambient spend. |
| `GET /api/cognition/metrics` | `apps/web/src/app/api/cognition/metrics/route.ts` | HTTP snapshot endpoint. |

## Backfilling existing data

The current Cognition Store (`InMemoryCognitionStore`) holds **authority
chunks** — regulations, staff notices, firm precedents. None of those
should migrate into the lesson store; they keep living where they are.

The lesson store starts **empty**. To seed from historic matters, run:

```ts
import { consolidateMatterLessons } from "@/lib/lessons";
import { getDefaultMatterStore } from "@/lib/matter-store";

const store = getDefaultMatterStore();
const matters = await store.list("<organizationId>");
for (const m of matters) {
  await consolidateMatterLessons(m.id, `backfill-${m.id}`);
}
```

This drives the matter-context bundle for each matter through the
sidecar. Idempotent — re-running just re-reinforces existing lessons.
A short script wrapper lives in your shell history; we deliberately
did NOT add a CLI in this branch to keep the diff focused.

## What did NOT make it in (and why)

### OAuth provider waterfall (Claude Max / ChatGPT Pro)

The original task asked for an OAuth waterfall preferring consumer
subscriptions before falling back to API keys. We did not build that.

- Claude Max and ChatGPT Pro are end-user subscription products. They
  do **not** expose a sanctioned programmatic API. Reverse-engineering
  the web flow's session cookies would put us outside the providers'
  Terms of Service.
- The provider layer is therefore **API-key based**, ordered by cost:
  1. Local Ollama (`OLLAMA_BASE_URL`) — free.
  2. Anthropic Haiku — `ANTHROPIC_API_KEY`.
  3. OpenAI gpt-4o-mini — `OPENAI_API_KEY`.

  Selector source: `lessons/provider.ts`. The hard per-cycle budget
  cap is wired in `ResourceCalculator.canStartCycle`.

If the right answer here is Anthropic's published Claude-for-Business
or AWS Bedrock OAuth flows, that's a separate branch — the cascade
order in `provider.ts` is the only place that needs to change.

### Multi-model debate layer

The task description implied a debate layer already exists. It does
not in this codebase, and adding one is a much larger architectural
move than two-layer consolidation. Out of scope here. The provider
cascade does not preclude one — a debate orchestrator could ask the
sidecar / garden for the same provider, then run N-way calls itself.

### Rule-corpus git hook

The scheduler accepts `corpus-commit` wakes via
`scheduler.notifyCorpusCommit(orgId, sha)`. The actual git
post-receive hook isn't shipped — wiring a hook depends on whether
the rules corpus lives in this repo (not at present), in a sibling
repo, or in a CMS. The wake API is stable; the trigger source can
move later without touching the garden.

## Resource & rate-limit configuration

Defaults in `apps/web/src/lib/lessons.ts`:

```
tokensPerHour:           200,000
ambientTokenCapPerCycle: 8,000
rateLimitMargin:         0.10
```

Override via env vars only if you mount a real provider-meter; the
defaults are tuned for a single-tenant preview. Provider rate-limit
headers are recorded via `ResourceCalculator.recordRateLimitHeaders`
— not yet wired automatically; the next-step would be a fetch wrapper
that scrapes `x-ratelimit-remaining`.

## Persistent queue location

`WAKE_QUEUE_PATH` env var (NDJSON file). Unset → in-memory queue,
which is fine for dev and Railway preview (ephemeral disk anyway).
On a deployment with a mounted volume, set it to e.g.
`/data/wake-queue.ndjson`.

## CRUMB and the sidecar

The repo doesn't currently emit CRUMB blocks as inter-agent on-the-wire
messages. The closest analogue is the matter-context bundle that the
handoff DOCX renders from. The sidecar's "CRUMB receive" hook is
therefore wired at approval-request time:

- POST `/api/approvals` → fire-and-forget `consolidateMatterLessons()`
  → walks the matter's audit + evidence and emits lesson candidates.
- The scheduler also receives a `session-close` wake on the same path.

The `parseCrumbToCandidates` utility is shipped for any future caller
that does receive a real CRUMB block (e.g., a CLI uploading a matter
handoff for retroactive learning).

## Bandit-arm continuity (Evolution DB)

The existing `ucb1Pick` in `packages/agents/src/sampler.ts` samples
matters in the risk queue, not lessons. Lessons-as-bandit-arms isn't
wired anywhere today, so supersession can't orphan an arm that
doesn't exist. The store's design **does** keep this honest: the
garden's `markSuperseded(loserId, winnerId)` preserves the winner's
id, so any future bandit that ties arms to lesson ids never has its
key invalidated by consolidation.

## Verification checklist

- `pnpm typecheck` — full workspace, clean.
- `pnpm vitest run packages/cognition/src/lessons/__tests__/` — 18 tests
  across sidecar, garden, scheduler, CRUMB parser, and a 1000-turn
  consolidation simulation.
- `GET /api/cognition/metrics` — returns the live snapshot.
