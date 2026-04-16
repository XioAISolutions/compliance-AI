# XIO Compliance Brain

Citation-first securities compliance workbench with a multi-agent
timeline and an evidence graph.

**Primary surface:** Canadian securities compliance — offering memorandum
review, KYC/AML gap checks, marketing material sign-off, response memos.
Grounded in NI 45-106, OSC Rule 45-501, NI 31-103, Securities Act
(Ontario), NI 81-102 Part 15, and CSA staff notices.

**Infosec surface (separate):** SOC 2 · GDPR · EU AI Act · ISO 27001
control catalogs with drafter/reviewer/evidence-collector/risk-assessor
personas. Lives at `/controls`; has its own cognition corpus, isolated
from securities matters.

## Status

`v0.3.0` — Multi-agent timeline + evidence graph + real task fan-out:

- **Input → Context → Output** three-pane layout at `/matters/[id]`
- **Three-tab main canvas**: Output · Transcript · Graph
- **Multi-persona loop** (drafter ↔ judge, with @mention fan-out) —
  drafter/om-reviewer/kyc-reviewer/marketing-reviewer/response-drafter
  leads, judge verdicts, reviewer/risk-assessor/evidence-collector
  reachable via @mention or `hand_off` tool call
- **Structured citations, end-to-end** — `parseModelOutput()` runs
  server-side, SSE emits a `citations` event with redacted prose + a
  validated `Citation[]`, UI renders `[cN]` superscripts with hover
  cards and a footnote list
- **Task persona fan-out** — each task type has its own system prompt
  (OM review, KYC gap check, marketing sign-off, response memo) — no
  more "all four tasks use the OM reviewer prompt"
- **Typed tool-call abstraction** — `cite_authority`, `flag_gap`,
  `request_review`, `hand_off` emitted as `{{tool:<name> <json>}}`
  spans in persona output, parsed server-side, rendered as typed chips
- **Multi-persona timeline (Transcript tab)** — reply-threaded bubbles,
  colored identity pills, status dots, round chips, JSONL export
- **Evidence graph (Graph tab)** — Sigma.js canvas with matters,
  documents, authorities, citations, agent turns, gaps. Force-atlas2
  layout; 360° context panel on node click (incoming / outgoing /
  metadata)
- **Hybrid retrieval** — BM25 + (reserved) semantic via RRF in the
  in-memory cognition store; `searchMode: "hybrid" | "bm25" | "jaccard"`
- **Per-surface cognition tenancy** — `getDefaultCognitionStore("securities" | "infosec")`
  isolates the two corpora so infosec chat can't pull securities
  authorities and vice versa
- **Matter-scoped refinement chat** — `/api/matters/[id]/chat` applies
  jurisdiction + registration filters; the legacy `/api/chat` still
  powers the infosec surface
- **Hash-chained audit trail** + **JSONL transcript** — audit-log for
  tamper-evidence (regulator-facing); transcript for replay
- Truthful inference disclosure: "Cloud inference via Anthropic with
  enterprise zero-retention"

See [docs/redesign.md](docs/redesign.md) for the product spec and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the upstream
cannibalization ledger (ASI-Evolve, agentchattr, GitNexus).

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
5. Watch the Output tab stream in; hover citation superscripts for quote cards
6. Flip to the **Transcript** tab for the reply-threaded multi-agent timeline
7. Flip to the **Graph** tab to see the evidence graph — click nodes for 360° context
8. Download the JSONL transcript from the link at the bottom of the Transcript tab
9. Export the deliverable as Markdown from the Output tab

The infosec control catalog is still available at `/controls`.

## Running tests

```bash
pnpm test
```

## Monorepo layout

```
apps/
  web/                     Next.js 16 web app
    src/app/
      matters/             Input → Context → Output + Output/Transcript/Graph tabs
      controls/            Infosec control catalog (separate surface, isolated cognition)
      api/agents/          Agent registry
      api/matters/         Matter CRUD + OM review SSE + matter-scoped refinement chat
                           + transcript (JSON + JSONL)
      api/chat/            Legacy infosec chat endpoint
    src/lib/
      matter-store.ts      In-memory matter store (Day 3 → Postgres)
      audit-store.ts       Hash-chained audit log (Day 3 → Postgres)
      evidence-graph.ts    Pure graph builder + 360° context
packages/
  agents/                  Personas + router + loop + citations + sampler
    src/personas/          drafter, reviewer, evidence-collector, risk-assessor,
                           judge, om-reviewer, kyc-reviewer, marketing-reviewer,
                           response-drafter
    src/citations.ts       Structured citation parser + validator
    src/loop.ts            Multi-persona loop coordinator (drafter ↔ judge with
                           @mention fan-out + tool-call parsing)
  chat-structure/          Registry + @mention router + loop guard + tool calls +
                           JSONL transcript (cannibalized from agentchattr)
  cognition/               RAG store interface + in-memory backend (BM25 + RRF) +
                           seed authorities
    src/authorities.ts     Ontario/EMD authority seed data (6 rules)
    src/in-memory.ts       BM25 + Jaccard + hybrid (RRF) scoring
  frameworks/              Control discriminated union + seed catalogs
  db/                      Drizzle schema (orgs, users, controls, matters,
                           audit_log, control_revisions, cognition_items) + RLS
docs/
  redesign.md              Product redesign spec
  build-plan.md            Original 5-day roadmap
```

## Design decisions

**Input → Context → Output, with a tabbed main canvas.** The chat-centric UI
confused clients. The redesign makes the deliverable the hero; the Transcript
and Graph tabs let a reviewer audit how the deliverable was produced.

**Multi-persona loop with @mention fan-out.** The drafter/om-reviewer leads;
the judge verdicts. During a round, the lead can @mention or `hand_off` to
any other persona (risk-assessor, evidence-collector, reviewer) and the
coordinator dispatches a follow-up before advancing to the judge. The
loop-guard caps agent→agent hops per loop to prevent runaway chains.

**Structured citations, end-to-end.** `parseModelOutput` runs server-side
and validates every `[cN]` against the retrieved chunk-IDs before shipping
to the UI. Orphaned markers and unused citations are reported as debug
signals on the `citations` event. The output pane renders `[cN]` as hover
superscripts; the Graph tab renders them as colored nodes.

**Typed tool calls.** `cite_authority`, `flag_gap`, `request_review`,
`hand_off` — agents emit them as `{{tool:<name> <json>}}` spans. The loop
coordinator parses them out of the draft, emits `tool-call` events, and the
Timeline UI renders typed chips instead of prose.

**Evidence graph.** Matters, documents, authorities, citations, agent
turns, gaps — with `contains`, `cites`, `grounds`, `flags`, `replies`
edges. The 360° panel answers "why did the agent cite this?" in one click:
follow the `grounds` edge back to the turn, the `cites` edge forward to
the authority.

**Hybrid retrieval.** BM25 + RRF in the in-memory store — when embeddings
land (pgvector, Day 3+), the semantic rank slot is already wired; no
caller-code changes.

**Per-surface cognition tenancy.** `"securities"` and `"infosec"` stores
are separate singletons. An EMD matter can never pull SOC 2 guidance, and
a SOC 2 control can never pull NI 45-106 — the two corpora are quarantined
by design, not by filter.

**Hash-chained audit trail + JSONL transcript.** Audit-log is tamper-evident
(regulator-facing); transcript is replayable (engineer-facing). They don't
duplicate: a single audit-log "generation" row spans multiple transcript turns.

**Truthful inference disclosure.** The UI says "Cloud inference via Anthropic
with enterprise zero-retention on your documents." No false "on-device"
claims.

## License

Apache-2.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for
upstream attribution.
