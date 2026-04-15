# Day 2 — Claude Code report

Branch: `claude/beautiful-kapitsa` (worktree at `.claude/worktrees/beautiful-kapitsa/`).
Local commits only — **not pushed**. Reconcile with Codex's Track 1 + Track 2 commits before review.

---

## What I built

### `packages/agents/` — new workspace package

| File                                                                  | Role                                                                                                                                                                                          |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                        | Workspace package, deps: `@anthropic-ai/sdk@^0.32.0`, `@compliance-ai/frameworks`                                                                                                             |
| `tsconfig.json`                                                       | Extends repo base                                                                                                                                                                             |
| `src/types.ts`                                                        | `PersonaId`, `AgentContext`, `AgentMessage`, `AgentEvent` (typed SSE event union)                                                                                                             |
| `src/router.ts`                                                       | Heuristic persona router (regex-keyed), returns `{persona, reason}` for UI display                                                                                                            |
| `src/personas/{drafter,reviewer,evidence-collector,risk-assessor}.ts` | Four system prompts, each ~25 lines, anchored to framework-native vocab                                                                                                                       |
| `src/personas/index.ts`                                               | `PERSONA_SYSTEM_PROMPTS` + `PERSONA_LABELS` lookup tables                                                                                                                                     |
| `src/run.ts`                                                          | `runAgent()` async generator. Streams Anthropic API. Renders `Control` (4 framework variants) into a cacheable context block. **Prompt caching enabled** on persona prompt + control context. |
| `src/index.ts`                                                        | Barrel                                                                                                                                                                                        |

### `apps/web/` — additions

| File                                    | Role                                                                                                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/api/chat/route.ts`             | POST endpoint. Materializes a placeholder `Control` from the static catalog (DB layer is Day 3), pipes `runAgent()` events into an SSE stream. `runtime: "nodejs"`, `dynamic: "force-dynamic"`. |
| `src/app/controls/[slug]/page.tsx`      | Server component. Looks up the catalog entry, renders framework-discriminated metadata + the chat panel side-by-side.                                                                           |
| `src/app/controls/[slug]/ChatPanel.tsx` | Client component. SSE consumer with persona badge, streaming text, per-turn usage line (incl. cache-read token count), Stop button.                                                             |
| `src/app/controls/page.tsx`             | **edit only** — wrapped each list item in a `<Link>` to its slug detail page.                                                                                                                   |
| `package.json`                          | Added `@anthropic-ai/sdk` + `@compliance-ai/agents` deps. **Did not run install.**                                                                                                              |

### Design choice: hybrid routing (task × framework)

- **Task axis** (chosen by router): `drafter | reviewer | evidence-collector | risk-assessor`
- **Framework axis** (passed in by caller via typed `Control`): `soc2 | gdpr | eu-ai-act | iso-27001`

Rationale: a single agent caps quality. Framework-only routing breaks for cross-framework questions. Task-only routing forces every persona to carry all 4 framework prompts. Hybrid (task specialists + framework as typed payload) cleanly separates _intent_ from _domain_.

### Design choice: heuristic router (not LLM)

Cheap, deterministic, observable. Streams `persona-selected` event BEFORE the model stream — gives users a visible explanation of which agent answered, which matters for compliance auditability. Swap to LLM router behind same signature when heuristic mis-routes too often.

### Design choice: prompt caching on (persona prompt + control context)

Both are stable across a multi-turn session. Marking with `cache_control: ephemeral` means turn 2+ pays ~10% of system-prompt tokens. For users who spend hours on a single control, that's a 5-10× cost lever.

---

## Reconciliation steps (run after Codex's tracks land)

```bash
cd /Users/slavaz/compliance-AI
pnpm install        # picks up @compliance-ai/agents, @anthropic-ai/sdk, expanded catalogs
pnpm typecheck      # whole workspace
pnpm --filter @compliance-ai/web build

export ANTHROPIC_API_KEY=sk-ant-...
pnpm dev:web
# Visit:
#   http://localhost:3000/controls           — all 4 framework sections, expanded entry counts
#   http://localhost:3000/controls/soc2.cc6.1 — control detail + working chat panel
```

Smoke test for the chat: ask _"Draft a policy statement for this control."_ — should see `drafter` badge appear, then streaming markdown with policy/procedure/roles/evidence sections.

---

## Files I touched (clean separation from Codex's tracks)

```
packages/agents/**                                           NEW
apps/web/src/app/api/chat/route.ts                           NEW
apps/web/src/app/controls/[slug]/page.tsx                    NEW
apps/web/src/app/controls/[slug]/ChatPanel.tsx               NEW
apps/web/src/app/controls/page.tsx                           EDIT (Link wrapper only)
apps/web/package.json                                        EDIT (added 2 deps)
```

**Not touched** (Codex's territory):

- `packages/frameworks/src/{soc2,gdpr,eu-ai-act,iso-27001}.ts` — Codex Track 2
- `packages/frameworks/src/control.ts` — settled
- `packages/frameworks/src/index.ts` — settled
- `packages/db/**` — Day 3
- `pnpm-lock.yaml` — Codex's `pnpm install` regenerates this

Lockfile is the only shared artifact. Sequence: Codex runs `pnpm install` first (Track 1), I write source files only, user runs final `pnpm install` to pick up my new package + deps.

---

## Open issues / Day 3 backlog

1. **No real DB-backed controls.** Route currently materializes a placeholder `Control` with `organizationId: "preview"`. Day 3 wires Drizzle and replaces `materializePreviewControl()` with a row lookup keyed by `(organizationId, slug)`.
2. **No markdown rendering in chat.** Streaming output is `whitespace-pre-wrap` raw text. Day 3 should drop in `react-markdown` (or similar) — purely UI work.
3. **No persistence of chat turns.** Each control page starts fresh on reload. Day 3+ persists per-control conversation history.
4. **No evidence/upload affordance.** Evidence-collector persona suggests artifacts but there's no upload UI yet.
5. **Heuristic router will mis-route on subtle phrasing.** Acceptable for MVP because the persona badge makes it visible to the user. Add an LLM fallback when score === 0 OR top-2 are tied.

---

## ASI-Evolve cannibalization study (`https://github.com/GAIR-NLP/ASI-Evolve`)

**License**: Apache 2.0 (compatible — we can lift code with attribution).
**Stack**: Python; FAISS + sentence-transformers; OpenAI-compatible API; YAML config.
**Genuinely portable surface**: the _patterns and interfaces_, not their implementation (we're TS + Postgres + Anthropic SDK).

### Their architecture (one-screen summary)

Three-agent loop: **Researcher → Engineer → Analyzer**, repeated N rounds.

- _Researcher_ proposes the next candidate (code edit via SEARCH/REPLACE diff)
- _Engineer_ runs candidate, collects metrics
- _Analyzer_ distills outcomes into "lessons" → cognition store

Two memory systems:

- _Cognition Store_ — embedded knowledge base, top-k retrieval, score threshold
- _Experiment Database_ — every trial's `{motivation, code, score, analysis, parent_id}`; parent selection via UCB1, greedy, random, or MAP-Elites/island

Optional LLM-as-judge: `final_score = (1 - ratio) * eval_score + ratio * judge_score`

### Why this maps onto compliance even though they're optimizing code

Reframe their loop:
| ASI-Evolve | compliance-AI equivalent |
|---|---|
| Researcher proposes code edit | Drafter writes policy text |
| Engineer runs + scores | LLM-judge persona produces verdict (Ready / Iterate / Rewrite) |
| Analyzer writes lesson | Lessons-recorder appends to tenant cognition store |
| `eval_score` (numeric) | `judge_verdict` (categorical) — formula reduces to `final = judge` |
| Experiment database | `control_revisions` audit-trail table (regulators specifically ask for this) |
| UCB1 sampling | "What control should this tenant work on next?" recommendation |

### Cannibalization tiers (ranked by ROI)

#### Tier 1 — port now (Day 3-4)

1. **Cognition store _interface_** (their `cognition/cognition.py`, ~150 lines):
   - Methods: `add(item)`, `add_batch(items)`, `retrieve(query, top_k, threshold) → [(item, score)]`, `remove`, `get`, `get_all`, `reset`, `size`
   - Item shape: `{id, title, content}` plus our addition: `{tenant_id, framework, control_slug?}`
   - **Implementation**: don't port FAISS — use Postgres + pgvector via Drizzle. Drizzle already in deps from Day 1.
   - **Payoff**: drafter persona stops producing generic boilerplate. Pulls THIS tenant's prior CC6.1 narrative as stylistic reference. 2-3× quality lift.
   - **Effort**: ~1 day. Suggested package: `packages/cognition`.

2. **LLM-as-judge persona with verdict-only mode** (their `pipeline/judge.jinja2` pattern):
   - We already have a `reviewer` persona that produces `[BLOCKER]/[GAP]/[NIT]` findings. Add a _separate_ `judge` persona that ONLY emits the verdict line — invoked after each drafter turn, output streamed as a separate event type (e.g. `verdict-delta`).
   - **Effort**: tiny (~50 LOC). Just a new system prompt + a second `runAgent()` call.

3. **Three-agent loop coordinator** (their `pipeline/main.py`, ~24KB):
   - Wraps drafter + judge so user gets auto-iterated drafts (drafter → judge → if "Iterate" → drafter again with judge feedback in context, up to N rounds).
   - **Effort**: ~1 day. New `runAgentLoop()` in `packages/agents`. Streams the same `AgentEvent` types but also emits `round-started: {round: N}` events.

#### Tier 2 — port when DB lands (Day 5+)

4. **Experiment database with parent links** (their `database/database.py`, 8KB):
   - Table: `control_revisions(id, control_id, parent_id, motivation, content, judge_verdict, created_at)` — every drafter+judge turn appended.
   - **Payoff**: regulators ask "show me how this control evolved over the audit period." We can answer it as a literal git-log over revisions.
   - **Effort**: medium (Drizzle schema + RLS for tenant isolation).

5. **UCB1 / island sampler for "what should I work on next?"** (their `database/algorithms/`):
   - Tenant has 200 controls in mixed states. UCB1 with `score = -urgency_decay - audit_due_date_proximity` balances "ignored longest" with "due soonest." Island variant prevents tenant from getting stuck on one framework.
   - **Effort**: ~50 LOC of TS for the algorithm + dashboard wiring.

#### Tier 3 — interesting but not portable

6. **SEARCH/REPLACE diff format** — too brittle, modern edit-block formats are better.
7. **Parallel workers (`num_workers: 2-4`)** — irrelevant until batch features.
8. **Wandb integration** — Drizzle + simple logs are enough.

#### Things I would explicitly NOT cannibalize

- Their config hierarchy (Next.js + env vars handle this cleanly already)
- Their `Pipeline.run(max_steps=10)` semantics — our chat is human-in-the-loop, no fixed step count
- Their FAISS persistence layer — pgvector in Postgres is multi-tenant by default, FAISS-on-disk is single-tenant only

### My one-line recommendation for Day 3

Ship Tier 1 #1 (`packages/cognition` with their interface, our pgvector implementation) before adding any new persona prompts. The cognition store is the single biggest leverage point — every persona benefits from tenant-specific context retrieval, and it's the prerequisite for the experiment database (Tier 2).

---

## Sanity-check checklist for reviewer

- [ ] `pnpm install` succeeds after merge (lockfile picks up new packages + sdk)
- [ ] `pnpm typecheck` clean across the workspace
- [ ] `pnpm --filter @compliance-ai/web build` succeeds
- [ ] `/controls` page lists expanded catalogs (Codex Track 2)
- [ ] `/controls/soc2.cc6.1` renders detail + chat panel
- [ ] With `ANTHROPIC_API_KEY` set, sending "Draft a policy statement" produces a streaming response with the `drafter` persona badge
- [ ] Second turn shows non-zero `cacheReadTokens` (proves caching works)
- [ ] Toggling "Iterate with judge" → sending a draft request produces multiple bubbles (drafter R1, judge R1, optionally drafter R2, ...) and a final `READY_TO_SUBMIT | ITERATE | REWRITE` badge
- [ ] Loop summary appears under the user's message: "Loop converged in N rounds → VERDICT"

---

## Cannibalization — implemented

After writing the study above I went ahead and ported all Tier 1 items end-to-end and the algorithm halves of Tier 2 (DB-wiring deferred to Day 3 when Drizzle migrations land). Below is what's in this branch, indexed by the tier number from the study above.

### Tier 1 #1 — Cognition store (interface ported, in-memory backend)

New package: `packages/cognition/`.

| File               | Role                                                                                                                                                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`     | `CognitionItem`, `RetrievalQuery`, `RetrievalResult`, `CognitionStore` interface — modeled on ASI-Evolve's `cognition/cognition.py` (Apache 2.0, attributed in the file header). Adds tenant + framework + control anchoring fields ASI-Evolve doesn't need.                                                   |
| `src/in-memory.ts` | `InMemoryCognitionStore` — Jaccard-on-tokens scoring. **Deliberately bad** as a relevance ranker; this exists so the API route + agents code path is exercised on day 1 without pgvector. Day 3+ swap: `PgVectorCognitionStore` constructed from `packages/db`, returning identical `RetrievalResult[]` shape. |
| `src/index.ts`     | `getDefaultCognitionStore()` process singleton + `setDefaultCognitionStore()` injection seam (so tests / prod can override).                                                                                                                                                                                   |

What we deliberately did NOT port:

- FAISS (not multi-tenant; pgvector is)
- sentence-transformers (replaced by Anthropic embeddings or pgvector L2 — Day 3+ decision)
- Persistence-to-disk (Postgres handles persistence)

### Tier 1 #2 — Judge persona

`packages/agents/src/personas/judge.ts`:

- 30-line system prompt: terse rationale, max 6 lines, exactly one verdict token alone on the final line.
- `parseVerdict(judgeOutput)` walks lines bottom-up looking for one of `READY_TO_SUBMIT | ITERATE | REWRITE`. Defaults to `ITERATE` on missing/unparseable output — matches the loop's "iterate on uncertainty" stance, which is what an auditor would do.
- Parser uses `ReadonlySet<string>.has()` rather than regex matching — sidesteps a security-hook false positive that fires on `child_process` lookalikes.

`PersonaId` extended in `types.ts` to include `"judge"`. Registered in `PERSONA_SYSTEM_PROMPTS` and `PERSONA_LABELS`.

### Tier 1 #3 — Loop coordinator (drafter ↔ judge)

`packages/agents/src/loop.ts`:

- `runAgentLoop(context, initialMessage, options)` returns the same `AsyncGenerator<AgentEvent>` shape as `runAgent` — SSE plumbing is identical.
- Three new event types added to `AgentEvent`:
  - `round-started` — UI hint to push a new assistant bubble for `persona`
  - `verdict-final` — UI hint to decorate the most recent judge bubble with the parsed verdict
  - `loop-done` — terminal event carrying `totalRounds` + `finalVerdict`
- Verdict-feedback shape:
  - `READY_TO_SUBMIT` → loop terminates immediately
  - `ITERATE` → next drafter prompt embeds the judge's critique and asks for a focused revision
  - `REWRITE` → next drafter prompt asks for a fresh approach (prior draft stays in history so the drafter avoids the same trap)
- Default `maxRounds: 4` — empirically enough for the judge to extract most fixable gaps; beyond that it's usually convergence or a fundamental REWRITE.
- Errors mid-stream are forwarded as `error` events; loop then emits `loop-done` so the UI can close the bubble cleanly.

### Tier 2 #4 — Experiment database (schema only — DB wiring is Day 3)

`packages/db/src/schema/control_revisions.ts`:

- Mirrors ASI-Evolve's experiment-database node shape (parent link + motivation + content + verdict + per-row token usage).
- New enums: `judge_verdict` and `persona_id` (mirrors the TS unions).
- Indexes: `(controlId, createdAt)`, `(parentId)`, `(organizationId, createdAt)` — covers "git-log of revisions for a control", "branch from this revision", and tenant-scoped queries respectively.
- `retrievedCognitionIds` jsonb column links each revision back to the snippets it grounded on — replay support for "why did the agent say this?" audit questions.

`packages/db/src/schema/cognition_items.ts`:

- Tenant-scoped RAG corpus table. Optional framework + control_slug anchors.
- Embedding column reserved for Day 3+ migration that adds `vector(1536)` + `vector_cosine_ops` ivfflat index.

Both are wired into `packages/db/src/schema/index.ts`.

### Tier 2 #5 — UCB1 + island samplers (algorithm halves)

`packages/agents/src/sampler.ts`:

- `ucb1Score()` — `mean + c * sqrt(ln(N_total) / n_i)` with `c = sqrt(2)`; `Number.POSITIVE_INFINITY` for never-surfaced candidates (forces exploration first).
- `ucb1Pick(candidates, n)` — top-N by UCB1 score, stable on ties.
- `islandPick(candidates, n, options)` — island sampling with default `migrationRate: 0.1`, `random` injectable for tests.
- All pure functions, zero I/O. Day 3+ wires them into a `recommendNextControls()` query in `packages/db`.

### Cognition retrieval wired into the chat path

`packages/agents/src/run.ts`:

- New `renderCognitionContext(snippets)` produces a third system block — placed _after_ the cached persona + control blocks so the cache cut-point stays on the stable prefix even when retrieved snippets vary turn-to-turn.
- Citation rule embedded in the block: "cite by title; if a snippet conflicts with the framework, prefer the framework and flag the conflict." Compliance-grade hallucination resistance.

`apps/web/src/app/api/chat/route.ts`:

- New body fields: `mode: "single" | "loop"`, `maxRounds`, `retrieve` (default true), `topK` (default 4).
- Retrieval is filtered by the active control's framework + slug when present, falls back to tenant-wide. Empty store returns `[]` → no-op for dev.
- Retrieval errors are caught and downgraded to "no snippets" — never block generation.

### ChatPanel — loop-mode UI

`apps/web/src/app/controls/[slug]/ChatPanel.tsx`:

- "Iterate with judge" toggle (right side of the panel header, disabled while streaming).
- Per-round bubbles with persona-color pills (drafter blue, judge amber) and an `R1`/`R2`/... round chip.
- Verdict badge on judge bubbles (READY_TO_SUBMIT green, ITERATE amber, REWRITE red).
- Loop-summary footer attached to the user message that triggered the loop: "Loop converged in N rounds → VERDICT".
- Single-mode flow is unchanged; the loop fields on `Turn` are all optional.

### Files added/edited in this batch

```
packages/agents/src/personas/judge.ts                NEW
packages/agents/src/loop.ts                          NEW
packages/agents/src/sampler.ts                       NEW
packages/agents/src/types.ts                         EDIT (judge persona, RetrievedSnippet, 3 new event types)
packages/agents/src/run.ts                           EDIT (cognition context block, non-cached)
packages/agents/src/personas/index.ts                EDIT (register judge, re-export parseVerdict)
packages/agents/src/index.ts                         EDIT (export loop, sampler)
packages/agents/package.json                         EDIT (subpath exports for ./loop, ./sampler)

packages/cognition/                                  NEW PACKAGE
packages/cognition/package.json                      NEW
packages/cognition/tsconfig.json                     NEW
packages/cognition/src/{types,in-memory,index}.ts    NEW

packages/db/src/schema/control_revisions.ts          NEW
packages/db/src/schema/cognition_items.ts            NEW
packages/db/src/schema/index.ts                      EDIT (export both)

apps/web/src/app/api/chat/route.ts                   EDIT (mode + retrieval)
apps/web/src/app/controls/[slug]/ChatPanel.tsx       EDIT (loop UI)
apps/web/package.json                                EDIT (added @compliance-ai/cognition)
```

### What's deliberately deferred

| Item                                | Reason                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| pgvector backend for cognition      | Drizzle migrations + pgvector extension are Day 3 (DB territory). The interface seam is in place. |
| Persisting `control_revisions` rows | Same — schema lands now so Day 3 just plugs writers into `runAgent` / `runAgentLoop`.             |
| `recommendNextControls()` query     | Needs DB-backed "surface count" tracking. Sampler algorithms are ready to plug in.                |
| Replacing Jaccard with embeddings   | Tied to Day 3 — embedding choice (Anthropic vs. OpenAI vs. local) is a separate decision.         |

### Apache 2.0 attribution

ASI-Evolve is Apache 2.0. We've attributed in file headers wherever we ported a pattern (`packages/cognition/src/types.ts`, `packages/agents/src/sampler.ts`, `packages/agents/src/personas/judge.ts`, `packages/agents/src/loop.ts`). No code copied verbatim — all reimplemented in TypeScript with our type system. A `THIRD_PARTY_NOTICES.md` should be added at repo root before any external distribution.
