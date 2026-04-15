# compliance-AI — 5-day build plan

Status snapshot: this repo is a greenfield that pattern-borrows from
`XioAISolutions/penguinwalkos` without forking it. The compliance-AI monorepo
owns its own code; penguinwalkos owns its product. Shared lessons, not shared
packages (for now).

## Day 1 — Skeleton + control model (✅ done)

- [x] Turbo + pnpm workspace root
- [x] `tsconfig.base.json`, `.env.example`, `.prettierrc.json`
- [x] `packages/frameworks`: Control discriminated union + seed catalogs
      (SOC 2 CC, GDPR core, EU AI Act core, ISO 27001 core)
- [x] `packages/db`: Drizzle schema for `organizations`, `users`, `controls`
      with unified jsonb `framework_metadata`, plus RLS policies
- [x] `apps/web`: Next.js 16 shell, home, `/controls` index rendering the
      four seed catalogs server-side

What runs after this step: `pnpm install && pnpm --filter @compliance-ai/web dev`.
The `/controls` page works without a database (reads catalog from code).

## Day 2 — Agent runtime + SSE /chat

- `packages/agents`:
  - Import the 4 SOUL prompts from
    `the-brain/agents/awesome-openclaw-agents/agents/compliance/`
  - Define `Agent` type `{ id, persona, systemPrompt, tools }`
  - Router: given user message + current control context → pick agent
- `apps/web/src/app/api/chat/route.ts`: SSE stream using Anthropic SDK or Vercel
  AI SDK, bound to routed agent
- UI: `/controls/[slug]/chat` with streaming transcript

## Day 3 — Evidence vault

- `packages/evidence`:
  - `Evidence` schema: `{ id, controlId, kind, source, uri, sha256, collectedAt }`
  - Collectors interface (manual upload first; automated collectors later)
  - Pattern borrowed from `the-brain`: IndexedDB local staging, server sync
- UI: `/controls/[slug]` evidence panel (upload, list, preview PDF)
- Scoring: coverage % per control

## Day 4 — Framework expansion + adoption flow

- Full SOC 2 Common Criteria (CC1.1 → CC9.2)
- Adoption flow: `/onboarding/framework` to pick which frameworks apply
- Materialization: seed catalog → per-tenant `controls` rows

## Day 5 — Audit trail + approvals + onboarding

- `packages/audit-trail`: hash-chained log, tamper-evident
- `packages/approvals`: borrowed pattern from penguinwalkos `policies` package
- End-to-end onboarding: org create → framework adopt → first control reviewed
- Deploy to Railway

## Principles

1. **Greenfield, not fork.** Every file earned its way in.
2. **Framework-agnostic data model.** Adding ISO 42001 later is a seed file, not
   a schema migration.
3. **Local-first, server-enhanced.** Evidence works offline; syncs when online.
4. **Controls are the spine.** Evidence, agents, approvals, audit — everything
   routes through Control.
5. **Don't over-engineer Day 1.** The repo should compile today, not solve 2027.
