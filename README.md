# XIO Compliance Brain

> **Milan AI Week hackathon submission lives at `/demo/milan`** — see [`docs/MILAN_SUBMISSION.md`](docs/MILAN_SUBMISSION.md) for the one-pager and [`docs/HACKATHON_MILAN.md`](docs/HACKATHON_MILAN.md) for the architecture brief + 90-second video storyboard.

Canadian legal workbench. A lawyer drops a document, picks what kind of review they want, gets structured AI-assisted output grounded in Canadian law, verifies every citation, and exports a filed-work-product-ready DOCX — with a full audit trail from the first prompt to the final file.

## What a lawyer does (5 steps)

1. **Go to `/matters/new`** and pick the task type. Eight to choose from, from securities OM review to PIPEDA privacy review to court AI-use disclosure memo to contract redline.
2. **Drop the document**. PDF, DOCX, or plain text. The app classifies it, chunks it, creates a matter, and routes it to the right reviewer persona.
3. **The review streams in** with structured `[c1]` citations. Every citation carries source-locker metadata (jurisdiction, source type, authority date, confidence). The footnote list lands already colour-coded — green `✓ verified` against the seed corpus, blue `↗ canlii` with a click-through to verify manually, or red `✕ not found` for citations to investigate.
4. **Request approval** when the review looks right. Approval binds to the SHA-256 of the output text — any edit invalidates a prior approval, so the signoff is tied to the exact artifact.
5. **Export DOCX** (or redline DOCX for `contract-redline` matters). Export is **blocked** until the binding approval is in place. Exhibits appendix carries the source-locker metadata for every cited authority.

Every step writes to the hash-chained audit log: `query → retrieval → generation → verdict → approval-requested → approval-granted → export`.

## Task types

| Task | What it produces |
|---|---|
| `om-review` | OM compliance report: required-disclosures checklist, gap memo, risk flags, resale-restriction check, post-filing checklist |
| `kyc-gap-check` | KYC/AML gap report against NI 31-103 Part 13 + PCMLTFA + FINTRAC guidance |
| `marketing-signoff` | Flagged-claims table + required-disclosure checklist + revised-language suggestions for pitch decks, one-pagers, social posts |
| `response-memo` | Point-by-point draft response to an OSC / CIRO / FINTRAC / AMF deficiency or inquiry letter |
| `court-ai-disclosure` | AI-use disclosure memo for filed court materials — Federal Court / Ontario SC / ABKB / BCSC practice-direction compliant |
| `pipeda-check` | PIPEDA conformance review (Schedule 1 principles + s. 10.1 breach regime + Quebec Law 25 / AB PIPA / BC PIPA) |
| `missing-authority-scan` | Citation-risk audit over an existing matter's output — flags low-confidence, stale, wrong-jurisdiction, and uncited assertions |
| `contract-redline` | Inline redline of an uploaded draft → DOCX with strikethrough deletions, underlined insertions, footnoted rationale |

## Canadian source packs

Every matter is scoped to named authority bundles the wizard shows as chips before the review runs. Five packs ship by default:

| Pack | Scope |
|---|---|
| `ca-securities-ontario` | NI 45-106 + companion, NI 31-103 Part 13, NI 81-102 Part 15, OSC Rule 45-501, Securities Act (Ont) s. 130.1, CSA notices, OSC/CIRO/FINTRAC deficiency patterns (~120 items) |
| `ca-federal-aml` | PCMLTFA s. 6.2, FINTRAC Guideline 6G, FINTRAC examination patterns |
| `ca-consumer-protection` | Pan-Canadian — federal + every province + multi-provincial harmonization |
| `ca-privacy` | PIPEDA Schedule 1 + s. 10.1 + regs, OPC guidance, Quebec Law 25, AB PIPA, BC PIPA (9 items) |
| `ca-court-ai` | Federal Court + Ontario SC + ABKB + BCSC AI practice directions, LSO + CBA guidance (7 items) |

The matter wizard routes each task type to the right pack(s). `GET /api/source-packs?taskType=...` returns the live selection.

## Key guarantees

- **Every citation has structured provenance**. `{ authorityId, section, quote, jurisdiction, sourceType, authorityDate, confidence, pinpoint }`. The reviewer's UI renders pill badges for each. The DOCX export's Exhibits appendix carries them through.
- **Every review's citations are auto-verified**. The server runs the offline-corpus + CanLII URL-heuristic verifier after each review and streams the results as a `verifications` SSE frame. The matter page lands pre-coloured.
- **Every export is hash-gated**. `/api/matters/[id]/export` and `/api/matters/[id]/export-redline` return **403 `approval-required`** unless an approved approval binds to `sha256(output)`. Admin override via `X-Approval-Override: <reason>` (audited).
- **Every persona refuses to refuse**. When retrieval is partial, reviewers mark rows `[NEEDS VERIFICATION]` and keep producing work product. Meta-refusals ("I can't review because the corpus is incomplete") are explicitly disallowed.

## Quickstart

```bash
pnpm install
pnpm --filter @compliance-ai/web dev
```

Open `http://localhost:3000/matters/new`, pick a task type, drop a file.

For persisted production mode:

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/compliance_ai
pnpm --filter @compliance-ai/db db:migrate
psql "$DATABASE_URL" -f packages/db/rls/policies.sql
pnpm --filter @compliance-ai/web dev
```

Preview mode is intentional when `DATABASE_URL` and `NEXTAUTH_SECRET` are unset: the app uses in-memory stores and a synthetic preview session for anonymous demos.

## Provider modes

The agent runner supports three provider modes:

- Hosted preview: `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`.
- Private/local: `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL`, optional `OLLAMA_CHAT_MODEL`.
- Legacy: `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`.

If `LLM_PROVIDER` is unset the runtime picks OpenAI when `OPENAI_API_KEY` exists, Anthropic when only `ANTHROPIC_API_KEY` exists, otherwise local Ollama.

## Railway

Railway uses:

- `railway.json` healthcheck: `/api/healthcheck`
- `nixpacks.toml` build: `pnpm --filter @compliance-ai/web build`
- root start command: `pnpm start`, which binds Next to `0.0.0.0`

Minimum hosted preview variables:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
NEXTAUTH_URL=https://compliance-ai-preview-production.up.railway.app
```

Add `DATABASE_URL` and `NEXTAUTH_SECRET` when persistence and real auth are required.

## Verification

```bash
pnpm install
pnpm test            # 686 tests across agents / cognition / web
pnpm -r typecheck
pnpm --filter @compliance-ai/web build
pnpm smoke:demo      # full route + endpoint smoke (source-packs, verify, export-redline)
```

`pnpm smoke:demo` expects a running app at `http://127.0.0.1:3000`, or set `DEMO_BASE_URL` to test a deployed URL.

## HTTP surface

```text
GET   /api/healthcheck                          cognition + db + auth + provider + version + uptime
GET   /api/agents                               persona registry + timeline participants
GET   /api/source-packs                         list packs; ?taskType= and ?lane= filter
POST  /api/quick-review                         upload + classify + create matter
POST  /api/matters                              create matter from wizard
GET   /api/matters/[id]                         matter detail
POST  /api/matters/[id]/review                  SSE stream: thinking → prose → citations → verifications → verdict
POST  /api/matters/[id]/chat                    SSE stream: matter-scoped follow-up
POST  /api/citations/verify                     offline-corpus + CanLII URL verification for a citation batch
POST  /api/matters/[id]/export                  DOCX with exhibits appendix — gated on approved hash
POST  /api/matters/[id]/export-redline          DOCX redline (strikethrough/underline/footnote) — gated on approved hash
GET   /api/matters/[id]/handoff                 MatterContextBundle + DOCX handoff pack
GET   /api/matters/[id]/transcript?fmt=jsonl    persona events, chronological
GET   /api/matters/[id]/graph                   pure evidence graph
POST  /api/approvals                            reviewer creates / approves / rejects a request bound to an output hash
```

## Monorepo layout

```text
apps/web
  src/app/matters/new                 wizard (8 task types + source-pack chips + presets)
  src/app/matters                     matter workspace, timeline, graph, verification badges
  src/app/api/source-packs            lane-filtered pack listing
  src/app/api/citations/verify        batch verifier endpoint
  src/app/api/matters/[id]            review, chat, export, export-redline, transcript, graph, handoff
  src/lib/auto-verify.ts              server-side auto-verify helper
  src/lib/redline-diff.ts             inline diff token parser

packages/agents                       8 task-specific personas + retrieval plans + judge loop + citations
packages/cognition                    seeded authority corpus, hybrid retrieval, source-locker, source-packs, verifier
packages/approvals                    hash-bound approval state machine
packages/chat-structure               registry, mentions, typed tools, transcripts
packages/ingest                       PDF/DOCX/TXT parse, chunk, classify
packages/db                           Drizzle schema, migrations, RLS
packages/frameworks                   framework metadata (SOC 2, GDPR, EU AI Act) for the infosec surface
packages/prioritizer                  risk-queue scoring

scripts/smoke-demo.mjs                end-to-end smoke
```

## Design decisions

- **Source locker on every citation**: jurisdiction + type + date + confidence are first-class fields, not prose. Without structured provenance, a lawyer can't verify AI output at scale.
- **Multi-query retrieval plans per task type**: each reviewer has 10–18 short targeted BM25 queries, unioned and deduped, so the persona sees the full authority set its checklist demands. Replaces the single-pass-over-document-text retrieval that kept hitting "corpus is incomplete" refusals.
- **Never-refuse persona clauses**: reviewers produce partial output with `[NEEDS VERIFICATION]` flags rather than refusing when retrieval misses.
- **Auto-verify on review completion**: citations are checked against the seed corpus + CanLII URL heuristics as a follow-up SSE frame, so the user never has to click "Verify citations" before trusting the output.
- **Hash-bound signoff**: approval binds to `sha256(output)`, so post-approval edits invalidate the approval. Export is gated server-side, not UI-only.
- **Named source packs**: the authority corpus is organised into named bundles keyed to matter lane. A lawyer sees exactly which packs will be in scope before running the review.

## License

Apache-2.0
