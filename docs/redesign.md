# Product redesign: input -> context -> output

Status: implemented and superseded by the `/demo` cockpit layer. This document
is kept as the historical redesign rationale; current deploy/runbook details
live in `README.md`, `docs/demo-launch-layer.md`, and
`.claude-handoff/codex-railway-deploy.md`.

## Why

The April 15 client demo got lost. The UI advertised matters, an 18-category
document taxonomy, a filter grid (Hybrid/Authority/Jurisdiction), a graph
counter, an open control catalog, a chat panel, and four suggested prompts —
all competing for attention — and the session ended without a deliverable
the client could hand to anyone. The engine is good; the surface is noisy.

Two strategic problems on top of that:

1. **Positioning is split in half.** The deployed preview is a
   securities-regulatory workbench (matter = "Ontario / OSC", documents =
   `Offering memo`, `KYC/AML file`, sample PDFs are OSC authority rules).
   The repo is a SOC 2 / GDPR / EU AI Act / ISO 27001 catalog. One of these
   has to become the product; the other gets deferred.
2. **A load-bearing claim was false.** The UI said "All processing runs
   locally. No data leaves this device. Runtime: local-first model." The
   app now uses explicit provider disclosure: hosted preview can use OpenAI,
   private installs can use Ollama, and legacy Anthropic deployments remain
   supported.

## Pick the wedge

Ship **Canadian securities-regulatory review** as the product. ICP:

- Exempt Market Dealers, Portfolio Managers, small IIROC members
- Boutique securities-law firms
- In-house compliance officers doing OM review, marketing sign-off, KYC gap
  assessments, NI 31-103 / NI 45-106 mapping

Defer SOC 2 / GDPR / EU AI Act / ISO 27001 behind a separate surface ("XIO
Infosec") until the wedge has paying users. Every UI decision below assumes
this ICP.

## The three-pane flow

Replace the chat-centric workbench with **Input → Context → Output**.

### Input (always visible, compact)

- **Matter** with two scoping fields that actually filter retrieval:
  `jurisdiction` (Ontario / Quebec / BC / federal) and
  `registration category` (EMD / PM / IIROC dealer / Issuer / None)
- **Task** from a closed menu of four:
  - Review offering memo for gaps
  - KYC/AML gap check on client file
  - Marketing-material sign-off
  - Draft response/comfort memo
- **Document(s)** — single drop zone, no taxonomy dropdown. Auto-classify
  on upload and show the predicted type as an editable chip.

### Context (middle, collapsible)

Built automatically from matter + task. One toggle only: "Show me what
you're using."

- **Authorities** auto-loaded (e.g. OM review → NI 45-106, OSC Rule 45-501,
  relevant staff notices)
- **Client documents** in this matter
- **What's excluded and why** — one-line explanation ("IIROC rules hidden
  because registration category is EMD")

Kill the Hybrid / Authority / Jurisdiction chips. They're mock chrome
today; in the redesign they become a matter-level setting, not a per-query
toggle.

### Output (right, largest — the primary canvas)

The deliverable is the hero. Rendered as it streams.

- Gap memo / checklist / redline, whichever the task produces
- **Structured citations as superscripts** — hover shows quote + source,
  click opens PDF at page
- Judge-loop verdict (`READY_TO_SUBMIT` / `ITERATE` / `REWRITE`) shown on
  the output, not buried in logs
- One-click export: Word with exhibits appended, or PDF

**Chat is a drawer**, opened from the output for "refine this paragraph" or
"why did you cite this rule?" — not the stage.

## Hero flow: OM gap memo

Build this first, end to end, and demo it instead of the current tour.

1. **Input.** User picks matter (`Ontario / EMD`), task (`Review OM`), drops
   `offering-memo.pdf`.
2. **Context auto-assembled.**
   - Jurisdiction rules: NI 45-106, OSC Rule 45-501, applicable OSC staff
     notices
   - Registration category rules: NI 31-103 Part 13 (EMD-specific
     obligations)
   - Doc auto-classified as `offering memo`, chunked, embedded
3. **Output generated** in three sections:
   - **Required-disclosures checklist** — each row `found / partial /
     missing` with the exact rule cite
   - **Gap memo** — for each partial/missing item: what's missing, why it
     matters, exact rule text, suggested drafting language
   - **Risk flags** — unqualified forward-looking statements, missing
     rights of action, marketing claims that trigger NI 81-102 exposure
4. **Judge pass.** `READY_TO_SUBMIT` → done. `ITERATE` → regenerate the
   weak section. `REWRITE` → re-run with a corrective prompt. Verdict shown
   on the output.
5. **Export.** Word memo with cited rule extracts appended as exhibits.
6. **Audit trail row appended.** Input hash, authorities used, output hash,
   verdict, timestamp. Per-matter audit log surfaces this.

### Citation schema (structured, not free text)

Model currently cites as free prose
([`packages/agents/src/run.ts:100-114`](../packages/agents/src/run.ts#L100-L114)).
Replace with structured output:

```ts
type Citation = {
  id: string;          // in-doc unique, e.g. "c12"
  authorityId: string; // "ni-45-106"
  section: string;     // "2.9(2)(a)"
  quote: string;       // exact text pulled from chunk
  docId: string;       // source doc id
  chunkId: string;     // source chunk id
  page?: number;       // for PDFs, 1-indexed
};
```

Render as `[12]` superscript; hover card shows `{quote, authorityId §
section}`; click deep-links to the PDF at `page`. Copied to Word with
footnote markers preserved.

## Cuts and fixes

### Cut now — from the deployed preview

- The "All processing runs locally / No data leaves this device" claim
  until the implementation matches
- `Graph: N nodes / N edges` counter — mock, no backend
- `N resolved / N unresolved` counter — mock, no backend
- Hybrid / Authority / Jurisdiction filter chips — mock, no backend
- 18-option upload taxonomy — replace with auto-classify + 5 override
  options
- Infosec framework catalog from the securities UI — move to a separate
  surface

### Fix now

- Replace the privacy tagline with the truth: hosted preview can use OpenAI
  with sample documents, private installs can use local Ollama, and legacy
  Anthropic deployments remain supported
- Wire the matter jurisdiction + registration fields to actually filter
  retrieval — they're tags today

### Build next — the redesign

- Input → Context → Output layout (replaces the current 3-panel workbench)
- OM gap memo hero flow, wired to the judge loop
- Structured citation schema with hover cards and open-in-source

### Build after

- The other three task flows (KYC gap, marketing sign-off, response memo)
- Visible per-matter audit / evidence log
- A real graph (authorities × rules × docs × findings) — only if users ask

## Priority map (for issues)

| Priority | Issue                                                                    | Status |
| -------- | ------------------------------------------------------------------------ | ------ |
| P0       | Remove false "local-first / on-device" claim from UI (#6)                | DONE   |
| P0       | Delete mock chrome (graph, resolved, filter chips) and compress taxonomy (#7, #8) | DONE   |
| P0       | Separate the securities surface from the infosec catalog (#9)            | DONE   |
| P1       | Implement Input → Context → Output layout (#10)                          | DONE   |
| P1       | OM gap memo hero flow (spec: this doc, "Hero flow") (#11)                | DONE   |
| P1       | Structured citation schema with hover + open-in-source (#12)             | DONE   |
| P2       | Matter-level jurisdiction + registration filter retrieval (#13)           | DONE   |
| P2       | Per-matter audit / evidence log surfaced in UI (#14)                      | DONE   |

## Implementation summary

All issues implemented in a single branch (`claude/product-redesign`).

### What shipped

**Core types & schemas:**
- `Citation` type + parser + validator (`packages/agents/src/citations.ts`)
- `om-reviewer` persona added to `PersonaId` union, router, and registry
- `matters` + `matter_documents` + `audit_log` DB schemas
- `jurisdictionEnum`, `registrationCategoryEnum`, `matterStatusEnum`, `taskTypeEnum`, `documentTypeEnum` enums

**Agent changes:**
- OM reviewer persona with full structured output spec (`packages/agents/src/personas/om-reviewer.ts`)
- Citation instruction block auto-injected when snippets are present (`run.ts`)
- Router routes to `om-reviewer` for OM/securities/NI 45-106 keyword patterns

**Cognition:**
- `jurisdiction` + `registrationCategories` fields on `CognitionItem`
- `jurisdiction` + `registrationCategory` filters on `RetrievalQuery`
- In-memory store honors new filters
- 6 seeded Ontario/EMD authorities (`packages/cognition/src/authorities.ts`)

**Web app:**
- `/matters` — matter list + create form (jurisdiction, registration, task type)
- `/matters/[id]` — three-pane layout: InputPane / ContextPane / OutputPane
- InputPane: matter scope chips, document drop zone with auto-classify
- ContextPane: auto-loaded authorities with "Show details" toggle + exclusion reasons
- OutputPane: streaming output, citation superscripts with hover cards, judge verdict, export
- ChatDrawer: refinement drawer (chat demoted from stage to drawer)
- AuditLog: per-matter hash-chained audit trail with expand/collapse, CSV export, chain verification
- Home page: "XIO Compliance Brain" with securities-first positioning, infosec visually demoted
- Layout: truthful inference disclosure, no false "on-device" claims

**API routes:**
- `GET/POST /api/matters` — matter CRUD
- `GET/PATCH /api/matters/[id]` — detail with auto-loaded authorities + audit trail
- `POST /api/matters/[id]/review` — OM review via judge loop with audit trail wiring

**Tests:** 54 passing across 6 files (citations, router, cognition filtering, authorities seed, matter store, audit store)

### What was retired

The old standalone demo chrome, fake graph counters, resolved counters,
Hybrid/Authority/Jurisdiction chips, 18-option taxonomy, and false "on-device"
claim were retired. The `/demo` cockpit and `/matters` workspace are now the
active demo surfaces.

## What this doc is not

Not an architecture redesign. The agents, judge loop, cognition store, and
retrieval pipeline stay. This is a surface-area redesign: fewer panels,
truthful copy, one hero deliverable, structured citations.
