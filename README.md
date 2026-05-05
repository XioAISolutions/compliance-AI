# XIO Compliance Brain

**Triad Review Engine for audit-ready compliance work.**

XIO Compliance Brain is a Canadian legal and compliance workbench that runs
three reviewer perspectives over a matter — **Regulatory Counsel**, **Risk
Officer**, and **Evidence Auditor**. It verifies citations, surfaces
disagreement, creates hash-bound approvals, and exports audit-ready handoff
work product.

Built for the [AMD × lablab.ai Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer)
(May 4–10, 2026) using a Qwen / vLLM architecture targeting AMD Instinct
MI300X-class GPUs, with hosted-preview support through any OpenAI-compatible
provider.

> **Three AI reviewers. Verified citations. Audit-ready decisions.**

## 90-second judge demo path

1. Open the app — https://compliance-ai-amd-demo-production.up.railway.app
2. Click **Run 90-second judge demo** (or visit `/demo/judge` directly)
3. Read the **One answer vs Triad** comparison panel (top of page) — left
   column shows what a generic legal-AI chatbot would return for the same
   input, right column shows what the Triad found
4. Read the seeded Ontario offering memorandum review
5. Inspect the citation verification badges (verified / needs-check / missing / stale / jurisdiction-mismatch)
6. Read the **Where reviewers disagreed** panel and the final action
7. Inspect the approval gate — output hash, reviewer status, export blocked
8. Expand the **Show audit chain** disclosure — six hash-linked rows, each
   stamped with the provider/model that served it
9. Click **Download CRUMB handoff pack** to see the audit-pack format

For a live debate run with real model inference: visit `/demo/debate`,
watch the **ensemble shape panel** (N voice-dots → vLLM → MI300X with
live KV-cache %), click **Run debate**, optionally enable **Round 2**.
Cold-click warming banners on `/` and `/demo/debate` route a judge to
the seeded path automatically when the AMD droplet is offline.

## Why it matters

Most legal-AI tools give one confident answer. That's dangerous in
compliance. XIO Compliance Brain shows **three reviewer perspectives**,
**verifies the evidence**, **exposes disagreement**, and **blocks export
until the output is approval-ready**. Audit trails record which inference
engine served the matter, so a review run today on AMD/Qwen looks
identical in audit shape to one run tomorrow on OpenAI.

🌐 **Live demo (debate cockpit):** https://compliance-ai-preview-production.up.railway.app/demo/debate
📄 **Hackathon brief:** [AMD_HACKATHON.md](./AMD_HACKATHON.md)
🧪 **Self-hosted MI300X:** point any client at `http://<droplet-ip>:8000/v1` running `vllm/vllm-openai-rocm`

---

## Two products in one cockpit

1. **`/demo/debate`** — Multi-voice debate. Pick a use case (compliance review,
   code review, hard decision, document critique) or paste your own input.
   Three voices critique it in parallel against the same model. An editor
   summarises agreement / divergence / verdict. Optional Round 2 has each
   voice defend, update, or concede its stance based on the others.
2. **`/demo`** — Securities-compliance workbench. Drop an OM, KYC file,
   marketing deck, or regulator letter. AI classifies, routes to the right
   reviewer, cites the rules from a real NI 45-106 corpus, and emits a
   CRUMB-style audit pack.

The same `LLM_PROVIDER` env serves both — flip it once and everything moves.

## Quickstart

```bash
# Point the app at the live AMD MI300X droplet (or any vLLM endpoint)
cat > apps/web/.env.local <<'ENV'
LLM_PROVIDER=amd_vllm
AMD_VLLM_BASE_URL=http://<your-droplet-ip>:8000/v1
AMD_VLLM_MODEL=Qwen/Qwen2.5-72B-Instruct
ENV

pnpm install
pnpm smoke:llm                                # CLI ping → "ready" in ~200ms
pnpm dev:web                                  # → http://localhost:3000/demo/debate
```

Or skip the env file and use OpenAI / Ollama / Anthropic — see Provider Modes below.

## Surfaces

| Route                                               | What it does                                                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                                             | Hackathon landing — live provider pill, 4 use-case cards, value props, CTAs.                                                                               |
| `GET /demo/debate`                                  | Three-voice debate cockpit. Live tokens/sec pill. Round 2 toggle. Edit voices. Copy verdict / full report. Permalink share. View sample (offline-capable). |
| `GET /demo/debate#t=<id>&q=<base64>`                | Permalink — encoded prompt + template hydrate the cockpit on load. Hash never hits the server.                                                             |
| `POST /api/debate`                                  | SSE-streamed multi-voice panel + synthesis + (optional) round-2 follow-up.                                                                                 |
| `GET /api/healthcheck/llm`                          | Live ping reporting latency, sample, output tokens, tokens/sec, model context length.                                                                      |
| `GET /demo`                                         | Compliance cockpit: drop a document, get a cited review with audit trail.                                                                                  |
| `POST /api/quick-review`                            | Upload a doc → classify, chunk, create matter, write audit. Returns `{ matterId, classification, documentId }`.                                            |
| `POST /api/matters/[id]/review`                     | Streams a drafter↔judge review with citation-integrity retry.                                                                                              |
| `GET  /api/matters/[id]/handoff`                    | Exports a CRUMB-style audit pack. Frontmatter records `provider:` so receipts are reproducible across providers.                                           |
| `GET  /api/matters/[id]/transcript?fmt=jsonl\|json` | Stable transcript events.                                                                                                                                  |
| `GET  /api/matters/[id]/graph`                      | Pure evidence graph builder.                                                                                                                               |
| `GET  /api/healthcheck`                             | Subsystem rollup (cognition, db, auth, provider, version, uptime).                                                                                         |

## Provider Modes

The agent runner supports four provider modes — flip via `LLM_PROVIDER`:

- **AMD MI300X / vLLM**: `LLM_PROVIDER=amd_vllm`, `AMD_VLLM_BASE_URL`, optional `AMD_VLLM_MODEL` (default `Qwen/Qwen2.5-72B-Instruct`) and `AMD_VLLM_API_KEY`.
- **Hosted preview**: `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`.
- **Private/local**: `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL`, optional `OLLAMA_CHAT_MODEL`.
- **Legacy**: `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`.

If `LLM_PROVIDER` is unset, the runtime auto-detects: `AMD_VLLM_BASE_URL` →
`OPENAI_API_KEY` → `ANTHROPIC_API_KEY` → local Ollama. Explicit endpoint
trumps ambient credentials. See [.env.example](./.env.example).

## What makes this different

**Three voices, one GPU.** MI300X has 192 GB of HBM3, enough to host Qwen 2.5
72B AND serve a three-voice ensemble on the same card. Cloud APIs would need
roughly 4× H100s for the same trick.

**Citation-grade receipts.** Compliance reviews cite retrieved authorities for
every finding. CRUMB handoffs record which provider served the matter, so an
audit trail written today on AMD/Qwen is reproducible tomorrow against
OpenAI or Anthropic.

**Universal use cases.** Compliance · code review · hard decisions · doc
critique. Same machinery, different stances. Voices are editable in the
cockpit (rename, edit prompts, add a 4th).

**Visible AMD power.**

- Live tokens/sec pill while a debate streams.
- Context-window pill (`32K ctx`) sourced live from `/v1/models`.
- Round 2: a second parallel batch of inferences on the same single GPU.
- Same-GPU panel — three voices + synthesis (+ optional round-2) all served
  by one vLLM endpoint on one MI300X.

## Verification

```bash
pnpm install
pnpm test                                     # 350 unit tests + 1 AMD live smoke (skipped without env)
pnpm -r typecheck
pnpm lint
pnpm --filter @compliance-ai/web build
pnpm smoke:demo                               # exercises /, /demo, /matters, /api/healthcheck, etc.
pnpm smoke:llm                                # ping the configured LLM provider; --help for usage
```

Set `AMD_VLLM_BASE_URL=http://<droplet-ip>:8000/v1` to also run the AMD live
smoke test (`packages/agents/src/__tests__/amd-smoke.test.ts`).

`pnpm smoke:demo` expects a running app at `http://127.0.0.1:3000`, or set
`DEMO_BASE_URL` / `BASE_URL` to test a deployed URL.

## Persisted production mode

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/compliance_ai
pnpm --filter @compliance-ai/db db:migrate
psql "$DATABASE_URL" -f packages/db/rls/policies.sql
pnpm --filter @compliance-ai/web dev
```

Preview mode is intentional when `DATABASE_URL` and `NEXTAUTH_SECRET` are
unset: the app uses in-memory stores and a synthetic preview session for
anonymous demos.

## Railway

- `railway.json` healthcheck: `/api/healthcheck`
- `nixpacks.toml` build: `pnpm --filter @compliance-ai/web build`
- Root start command: `pnpm start` (binds Next to `0.0.0.0`)

Minimum hosted preview variables:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
NEXTAUTH_URL=https://compliance-ai-preview-production.up.railway.app
```

Add `DATABASE_URL` and `NEXTAUTH_SECRET` when persistence and real auth are
required. To run the AMD demo on Railway, swap to `LLM_PROVIDER=amd_vllm` +
`AMD_VLLM_BASE_URL` pointing at your reachable vLLM endpoint.

## Monorepo layout

```text
apps/web
  src/app/                          home page, navigation, footer
  src/app/demo                      compliance cockpit
  src/app/demo/debate               multi-voice debate cockpit + samples + UI
  src/app/matters                   matter workspace, timeline, graph
  src/app/api/quick-review          upload → classify → matter
  src/app/api/matters/[id]          review, chat, transcript, graph, handoff
  src/app/api/debate                SSE multi-voice + synthesis + round-2
  src/app/api/healthcheck           subsystem rollup
  src/app/api/healthcheck/llm       live LLM ping (latency, TPS, model ctx)
  src/lib/matter-context.ts         MatterContextBundle / CRUMB renderer
  src/lib/evidence-graph.ts         pure graph builder

packages/agents
  src/run.ts                        provider runtime (anthropic/openai/ollama/amd_vllm)
  src/debate.ts                     runDebate, synthesizeDebate, runFollowup
  src/health.ts                     pingProvider + /v1/models lookup
  src/personas/                     persona prompts (drafter, judge, OM/KYC/marketing reviewers)
  src/loop.ts                       drafter↔judge tight loop
  src/citations.ts                  citation parser + integrity validator

packages/chat-structure             registry, mentions, typed tools, transcripts
packages/cognition                  seeded stores and BM25 + RRF hybrid retrieval
packages/ingest                     PDF/DOCX/TXT parse, chunk, classify
packages/approvals                  approval state machine
packages/db                         Drizzle schema, migrations, RLS

scripts/smoke-demo.mjs              full-app readiness check
scripts/smoke-llm.mjs               provider-only ping (no Next.js)
AMD_HACKATHON.md                    hackathon brief: 60-second runbook + verified numbers
```

## Design decisions

The product surface is one cockpit, not competing demos. Securities review is
the primary wedge because the drop-document-to-cited-review story is concrete.
The multi-voice debate generalises the same engine to non-vertical use cases
(code review, decisions, doc critique) — same machinery, different stances.

The provider abstraction is env-flippable and additive: shipping the AMD
hackathon path didn't change a single Anthropic / OpenAI / Ollama code
path. CRUMB receipts record which provider served each matter so audit
trails stay reproducible across provider changes.

Adjacent repo ideas were cannibalized natively:

- The Brain inspired `MatterContextBundle` / demo case pack exports.
- CRUMB inspired the sanitized handoff renderer without adding a runtime repo dependency.
- PenguinWalkOS inspired the smoke contract for route and quick-review readiness.

## Hackathon

Built for the [AMD × lablab.ai Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer),
May 2026. Tracks: AI Agents & Agentic Workflows · Build in Public · `#AMDDevHackathon`.

See [AMD_HACKATHON.md](./AMD_HACKATHON.md) for the 60-second runbook, verified
performance numbers, and the full feature inventory.

## License

Apache-2.0
