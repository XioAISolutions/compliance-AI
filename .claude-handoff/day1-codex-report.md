# Day 1 / Catalog — Codex report

Local commits only. Nothing was pushed.

## What I did

- Ran `pnpm install`.
- Ran baseline `pnpm typecheck`; Day 1 scaffold passed before catalog expansion.
- Fixed the production build by adding ESM source shims for `packages/frameworks/src/*.js` so Next/Turbopack can resolve the existing TypeScript barrel imports without changing `packages/frameworks/src/index.ts` or `control.ts`.
- Ran `pnpm --filter @compliance-ai/web build`; build passed.
- Expanded the four seed catalogs as requested, committing each framework separately.
- After Claude's Day 2 agents/chat layer appeared in the same workspace, ran `pnpm install` again and made minimal compile/build fixes so the whole workspace passes:
  - `packages/agents/src/router.ts`: noUncheckedIndexedAccess-safe fallback for the top-ranked persona.
  - `packages/agents/src/run.ts`: Anthropic SDK type compatibility for prompt-cache blocks and cache-read usage.
  - `apps/web/src/app/controls/[slug]/ChatPanel.tsx`: concrete usage type for done events.
  - `packages/agents/src/**/*.js`: ESM shims matching the source-package pattern used in `packages/frameworks`.
  - `apps/web/next.config.ts`: moved `typedRoutes` out of `experimental` for Next 16.
- Visited `http://localhost:3000/controls` and verified all four framework sections render with expanded counts.

## Catalog counts

| Framework | Count | Notes |
|---|---:|---|
| SOC 2 | 33 | CC1.1 through CC9.2 Common Criteria |
| GDPR | 16 | Existing 6 plus Art. 5, 7, 17, 20, 25, 28, 35, 37, 38, 39 |
| EU AI Act | 12 | Existing 6 plus Art. 11, 12, 15, 16, 26, 72 |
| ISO 27001 | 16 | Four controls each across organizational, people, physical, technological |

## Local commits

- `chore(day1): pass typecheck + build`
- `catalog(soc2): expand CC series to CC1.1–CC9.2`
- `catalog(gdpr): add operational articles`
- `catalog(eu-ai-act): add high-risk provider obligations`
- `catalog(iso-27001): balance across four domains`

I also created a follow-up local Day 2 build-pass commit after Claude's agents/chat layer was present in the workspace.

## Verification

```bash
pnpm typecheck
pnpm --filter @compliance-ai/web build
```

Both pass across the current workspace, including `@compliance-ai/agents`.

Manual smoke:

```bash
pnpm --dir apps/web exec next dev --hostname 127.0.0.1 --port 3000
open http://localhost:3000/controls
```

Observed all four catalog sections and counts:

- SOC 2 — 33 controls
- GDPR — 16 controls
- EU AI Act — 12 controls
- ISO 27001 — 16 controls

## ASI-Evolve cannibalization

Reviewed [`GAIR-NLP/ASI-Evolve`](https://github.com/GAIR-NLP/ASI-Evolve). The repo describes a repeatable Learn/Design/Experiment/Analyze loop driven by Researcher, Engineer, and Analyzer agents, with a cognition store and experiment database. Its README also notes configurable sampling strategies (`ucb1`, `greedy`, `random`, `island`) and a cognition retrieval layer.

Best pieces to cannibalize later:

1. Cognition store interface: `add`, `add_batch`, `retrieve`, `get`, `reset`, `size`. Port the interface to TypeScript, but back it with Postgres/pgvector rather than FAISS-on-disk.
2. Experiment database concept: store every compliance draft/review revision with parent links, score/verdict, motivation, and analysis. This maps well to control audit trails.
3. Loop coordinator: adapt Researcher/Engineer/Analyzer into Drafter/Judge/Lessons Recorder for iterative policy/control drafting.
4. Sampling strategies: reuse UCB1/island ideas later for "which control should the tenant work on next?" prioritization.

Do not port directly:

- Python FAISS persistence layer.
- SEARCH/REPLACE edit format.
- Fixed autonomous step-count semantics. This product should stay human-in-the-loop.

## Blockers

- No remaining build/typecheck blocker.
- Chat streaming still requires `ANTHROPIC_API_KEY` at runtime.
- I did not push; commits are local only.
