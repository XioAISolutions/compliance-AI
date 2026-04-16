# XIO Compliance Brain

Citation-first securities compliance workbench.

**Primary surface:** Canadian securities compliance — offering memorandum review,
KYC/AML gap checks, marketing material sign-off, response memos. Grounded in
NI 45-106, OSC Rule 45-501, NI 31-103, Securities Act (Ontario), and CSA staff
notices.

**Infosec surface (separate):** SOC 2 · GDPR · EU AI Act · ISO 27001 control
catalogs with drafter/reviewer/evidence-collector/risk-assessor personas.

## Status

`v0.8.0` — Layers 1 + 2 + 3 + 4 shipped. Full 4-layer plan complete.

- **Layer 1 — document review works end-to-end**
  - Real PDF/DOCX/TXT upload via `@compliance-ai/ingest` (parse + chunk)
  - Reviewer persona reads the uploaded doc and cites specific chunks
  - Markdown rendering with inline `[c1]` citation superscripts
  - DOCX export with title page, body, and Exhibits appendix
- **Layer 2 — persistence across restarts**
  - Drizzle schemas for matters, documents, chunks, audit log, evidence, auth
  - `withOrg()` RLS helper + extended `policies.sql`
  - Repository factory: Postgres when `DATABASE_URL` set, in-memory otherwise
  - Migration covering 13 tables
- **Layer 3 — all four flows + evidence + risk queue**
  - Four specialized personas: OM review, KYC/AML gap check, Marketing sign-off, Response memo drafter
  - `drafterPersona` loop option so each task takes the right persona slot
  - Extended seed authorities: FINTRAC / PCMLTFA / NI 31-103 Part 13 / NI 81-102 Part 15 / OSC SN 33-316 + regulator deficiency patterns (16 authorities total)
  - Evidence management: per-matter items with `missing → requested → present → approved` state machine
  - Auto-generated evidence requests from PARTIAL/MISSING checklist rows in reviewer output
  - `/queue` — prioritized cross-matter work list via `@compliance-ai/prioritizer` (classical scoring + UCB1 island diversity)
  - QUBO/QAOA sidecar slot reserved for a future quantum backend
- Input → Context → Output three-pane layout (`/matters/[id]`)
- OM gap memo hero flow with judge loop (drafter ↔ judge, max 3 rounds)
- Structured citation schema
- Matter-level jurisdiction + registration category filtering on retrieval
- Per-matter hash-chained audit trail with CSV export + tamper verification
- Truthful inference disclosure: "Cloud inference via Anthropic with enterprise zero-retention"
- **Layer 4 — production-ready auth + onboarding + approvals + ops**
  - NextAuth v5 wiring with Drizzle adapter (`@auth/drizzle-adapter`); Credentials + optional GitHub / Google OAuth
  - Graceful auth fallback: preview mode (`NEXTAUTH_SECRET` unset) returns a synthetic session so the demo still works
  - `/login`, `/onboarding`, `/approvals` routes + middleware gating `/matters`, `/queue`, `/approvals`, `/onboarding`
  - `POST /api/onboarding/complete` creates the organization row, links the user with `role=owner`, seeds the tenant's authority corpus
  - `@compliance-ai/approvals` package — request/approve/reject/withdraw state machine with CCO sign-off, every event written to the audit chain
  - `/api/approvals` API with role-gated PATCH (owner/admin only for review actions)
  - `/api/healthcheck` returns per-subsystem status (cognition + database + auth) for Railway / ops probes
  - Replaced every `PREVIEW_ORG_ID = "preview"` with `session.organizationId`; preview sentinel now flows from `getSession()` fallback
  - Tightened `.env.example` with documented sections (Postgres, LLM, Auth + OAuth, integrations)
- **158 passing tests** across ingest, citations, router, cognition filtering, authorities, stores (matter/audit/evidence/approvals), bootstrap, withOrg, optimizer, risk-queue, auth

See [docs/redesign.md](docs/redesign.md) for the full redesign spec and
[/root/.claude/plans/sharded-fluttering-donut.md](/root/.claude/plans/sharded-fluttering-donut.md) (if accessible) for the 4-layer plan.

## Quickstart

**Preview mode (no database):**
```bash
pnpm install
pnpm --filter @compliance-ai/web dev
# open http://localhost:3000
```

**With Postgres:**
```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/compliance_ai
pnpm install
pnpm --filter @compliance-ai/db db:migrate
pnpm --filter @compliance-ai/web dev
```

After schema migrations, apply the RLS policies:
```bash
psql "$DATABASE_URL" -f packages/db/rls/policies.sql
```

1. Click **Open matters** on the home page
2. Create a new matter (Ontario / EMD / Review offering memo)
3. Upload your OM PDF
4. Click **Start review** — the OM reviewer runs through the judge loop
5. Export the deliverable as Markdown

The infosec control catalog is still available at `/controls`.

## Running tests

```bash
pnpm test
```

## Monorepo layout

```
apps/
  web/                    Next.js 16 web app
    src/app/
      matters/            Input → Context → Output layout
      controls/           Infosec control catalog (separate surface)
      api/matters/        Matter CRUD + OM review SSE endpoint
      api/chat/           Legacy chat endpoint (still works)
    src/lib/
      matter-store.ts     In-memory matter store (Day 3 → Postgres)
      audit-store.ts      Hash-chained audit log (Day 3 → Postgres)
packages/
  agents/                 Personas + router + loop + citations
    src/personas/         drafter, reviewer, evidence-collector, risk-assessor, judge, om-reviewer
    src/citations.ts      Structured citation parser + validator
  cognition/              RAG store interface + in-memory backend + seed authorities
    src/authorities.ts    Ontario/EMD authority seed data (6 rules)
  frameworks/             Control discriminated union + seed catalogs
  db/                     Drizzle schema (orgs, users, controls, matters, audit_log) + RLS
docs/
  redesign.md             Product redesign spec
  build-plan.md           Original 5-day roadmap
```

## Design decisions

**Input → Context → Output.** The chat-centric UI confused clients. The
redesign makes the deliverable the hero: a gap memo, checklist, or redline —
not a conversation transcript. Chat is demoted to a refinement drawer.

**Structured citations.** The model emits `[c1]` markers inline and a JSON
`citations` block. The parser cross-checks markers against the array, validates
chunk IDs against the cognition store, and renders hover cards in the UI.

**Matter-level filtering.** Jurisdiction + registration category on a matter
filter retrieval: an EMD matter never retrieves IIROC dealer-member rules.

**Hash-chained audit trail.** Every query, retrieval, generation, and verdict
writes a row with `prevRowHash` linking to the prior entry. Tamper-detectable.

**Truthful inference disclosure.** The UI says "Cloud inference via Anthropic
with enterprise zero-retention on your documents." No false "on-device" claims.

## License

Apache-2.0
