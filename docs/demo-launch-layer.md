# Compliance-AI launch demo layer

This branch adds a standalone demo surface without replacing the current scaffold.

## Routes

- `/demo` — command center with readiness score, talk track, top findings, and interactive assessment runner.
- `/demo/risk-queue` — cross-framework prioritized work queue.
- `/demo/evidence` — evidence request pack generated from the top findings.
- `/demo/launch-checklist` — operator checklist for demo validation and next production steps.
- `/api/demo/assessment` — deterministic preview assessment endpoint used by the command center.

## Why this is safe

- No database migration required.
- No QPanda/OriginQ runtime required.
- No dependency on another XIO repo.
- No existing app route is replaced.
- Demo logic lives under `apps/web/src/lib/demo` and can be deleted or promoted later.

## Product story

The demo uses the existing framework catalogs and turns them into a buyer-visible workflow:

1. Company profile intake.
2. Framework scope selection.
3. Risk and evidence scoring.
4. Prioritized control queue.
5. Evidence request pack.
6. Control workspace handoff into the existing chat + judge loop.

## QPanda / OriginQ integration point

The file `apps/web/src/lib/demo/optimizer.ts` is the seam for the future quantum optimization sidecar.

Today it uses deterministic classical scoring so demos work anywhere. Later, the same input contract can be sent to a Python QPanda sidecar for QUBO/QAOA-style risk prioritization experiments.

Do not put QPanda in the main Next.js runtime. Keep it as an optional service behind the optimizer contract.

## Demo validation

```bash
pnpm install
pnpm --filter @compliance-ai/web dev
# open http://localhost:3000/demo
```

Suggested flow:

1. Open `/demo`.
2. Run the interactive assessment.
3. Open `/demo/risk-queue`.
4. Open `/demo/evidence`.
5. Open a control from either page.
6. Use the existing compliance chat panel.
7. Toggle `Iterate with judge` for review-ready draft behavior.

## Production follow-up

- Persist assessment runs and generated findings.
- Swap demo profile for tenant onboarding data.
- Add pgvector-backed cognition retrieval.
- Add file upload/import for policies, auditor letters, and evidence.
- Add optional QPanda/OriginQ optimizer sidecar after the deterministic queue is proven useful.
