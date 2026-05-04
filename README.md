# XIO Compliance Brain

Demo-ready compliance cockpit for securities review, infosec GRC, evidence,
approval, transcript, graph, and handoff workflows.

> **AMD Hackathon (May 2026)** — this branch (`feat/amd-mi300x-vllm`) wires
> the whole pipeline onto Qwen 2.5 72B on a single AMD MI300X via vLLM. See
> [`AMD_HACKATHON.md`](./AMD_HACKATHON.md) for the 60-second runbook and the
> three new surfaces: `/demo/debate`, `/api/debate`, `/api/healthcheck/llm`.

The primary demo path is `/demo`:

1. Drop an offering memorandum, TXT, PDF, or DOCX.
2. Quick review parses, chunks, classifies, creates a matter, and writes audit.
3. The matter page opens with `?autoStart=1`.
4. Review streams into the output pane with structured `[c1]` citations.
5. Evidence requests, risk queue items, approvals, transcript events, and graph
   context become available from the same matter.
6. Export a native JSON bundle or a sanitized CRUMB-style handoff pack.

## Current Layer

`v0.9.0-demo-cockpit`

- `/demo` is the cockpit, with Securities Review first and Infosec GRC second.
- `/api/quick-review` accepts uploads and returns `{ matterId, classification, documentId }`.
- `/api/matters/[id]/chat` runs matter-scoped follow-up without crossing matters or surfaces.
- `/api/agents` exposes the demo agent registry and timeline participant map.
- `/api/matters/[id]/transcript?fmt=jsonl|json` exports stable transcript events.
- `/api/matters/[id]/graph` returns a pure evidence graph from matter context.
- `/api/matters/[id]/handoff` exports the `MatterContextBundle` plus CRUMB-style text.
- `/api/healthcheck` reports cognition, database, auth, provider, version, and uptime.
- `scripts/smoke-demo.mjs` checks `/`, `/demo`, `/matters`, `/queue`, `/approvals`,
  `/controls`, `/api/healthcheck`, `/api/agents`, and a synthetic quick-review upload.

## Provider Modes

The agent runner supports four provider modes:

- Hosted preview: `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`.
- Private/local: `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL`, optional `OLLAMA_CHAT_MODEL`.
- Self-hosted vLLM (e.g. AMD MI300X + Qwen 2.5): `LLM_PROVIDER=amd_vllm`,
  `AMD_VLLM_BASE_URL`, optional `AMD_VLLM_MODEL` and `AMD_VLLM_API_KEY`.
- Legacy: `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`.

If `LLM_PROVIDER` is unset, the runtime auto-picks: `AMD_VLLM_BASE_URL` →
`OPENAI_API_KEY` → `ANTHROPIC_API_KEY` → local Ollama. Explicit endpoint
trumps ambient credentials.

## Quickstart

```bash
pnpm install
pnpm --filter @compliance-ai/web dev
```

Open `http://localhost:3000/demo`.

For persisted production mode:

```bash
export DATABASE_URL=postgres://user:pass@localhost:5432/compliance_ai
pnpm --filter @compliance-ai/db db:migrate
psql "$DATABASE_URL" -f packages/db/rls/policies.sql
pnpm --filter @compliance-ai/web dev
```

Preview mode is intentional when `DATABASE_URL` and `NEXTAUTH_SECRET` are unset:
the app uses in-memory stores and a synthetic preview session for anonymous demos.

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
pnpm test
pnpm -r typecheck
pnpm --filter @compliance-ai/web build
pnpm smoke:demo
```

`pnpm smoke:demo` expects a running app at `http://127.0.0.1:3000`, or set
`DEMO_BASE_URL` to test a deployed URL.

## Monorepo Layout

```text
apps/web
  src/app/demo                    cockpit
  src/app/matters                 matter workspace, timeline, graph
  src/app/api/quick-review        upload -> classify -> matter
  src/app/api/matters/[id]        review, chat, transcript, graph, handoff
  src/lib/matter-context.ts       MatterContextBundle / DemoCasePack export
  src/lib/evidence-graph.ts       pure graph builder

packages/agents                   personas, provider runtime, citations, judge loop
packages/chat-structure           registry, mentions, typed tools, transcripts
packages/cognition                seeded stores and BM25 + RRF hybrid retrieval
packages/ingest                   PDF/DOCX/TXT parse, chunk, classify
packages/approvals                approval state machine
packages/db                       Drizzle schema, migrations, RLS

docs/compliance-handoff.md        PDF source
output/pdf/compliance-ai-demo-handoff.pdf
scripts/smoke-demo.mjs
```

## Design Decisions

The product surface is one cockpit, not competing demos. Securities review is
the primary wedge because the drop-document-to-cited-review story is concrete.
Infosec remains visible as the second surface to prove the architecture
generalizes without stealing the main path.

Adjacent repo ideas were cannibalized natively:

- The Brain inspired `MatterContextBundle` / demo case pack exports.
- CRUMB inspired the sanitized handoff renderer without adding a runtime repo dependency.
- PenguinWalkOS inspired the smoke contract for route and quick-review readiness.
- Claude Octopus is installed globally for orchestration skills, but the app does not
  depend on Octopus at runtime.

## License

Apache-2.0
