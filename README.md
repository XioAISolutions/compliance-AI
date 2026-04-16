# XIO Compliance Brain

Citation-first securities compliance workbench.

**Primary surface:** Canadian securities compliance — offering memorandum review,
KYC/AML gap checks, marketing material sign-off, response memos. Grounded in
NI 45-106, OSC Rule 45-501, NI 31-103, Securities Act (Ontario), and CSA staff
notices.

**Infosec surface (separate):** SOC 2 · GDPR · EU AI Act · ISO 27001 control
catalogs with drafter/reviewer/evidence-collector/risk-assessor personas.

## Status

`v0.2.0` — Redesign landed:

- Input → Context → Output three-pane layout (`/matters/[id]`)
- OM gap memo hero flow with judge loop (drafter ↔ judge, max 3 rounds)
- Structured citation schema (`[c1]` superscripts → hover cards → source link)
- 6 seeded Ontario/EMD authorities (NI 45-106, OSC 45-501, NI 31-103, Securities Act 130.1, Staff Notice 45-309, NI 81-102 Part 15)
- Matter-level jurisdiction + registration category filtering on retrieval
- Per-matter hash-chained audit trail with CSV export + tamper verification
- Auto-classify documents on upload (filename heuristics, 5 top types + Other)
- Truthful inference disclosure: "Cloud inference via Anthropic with enterprise zero-retention"
- **54 passing tests** across citations, router, cognition filtering, matter store, audit store

See [docs/redesign.md](docs/redesign.md) for the full redesign spec.

## Quickstart

```bash
pnpm install
pnpm --filter @compliance-ai/web dev
# open http://localhost:3000
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
