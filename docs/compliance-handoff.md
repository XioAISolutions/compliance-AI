# XIO Compliance Brain demo handoff

Generated for the Compliance-AI Demo Cockpit Layer.

## Demo promise

Drop a securities document, create a matter, classify it, run review, show
evidence, queue risks, route approvals, and export a handoff pack from one
cockpit.

## Primary story

Securities Review is the first tab in `/demo`. The live path is:

1. Upload an offering memorandum, KYC file, marketing document, or regulator
   letter.
2. Parse PDF/DOCX/TXT with `@compliance-ai/ingest`.
3. Classify task, jurisdiction, registration category, and document type.
4. Create a matter and append a hash-chained audit entry.
5. Redirect to `/matters/[id]?autoStart=1`.
6. Stream a cited review with judge-loop verdicts.
7. Open transcript and graph context.
8. Export a JSON case bundle or sanitized handoff text.

## Secondary story

The infosec surface is visible as the second cockpit tab. It reuses deterministic
assessment, evidence, controls, risk queue, approvals, and audit models so the
demo proves the same compliance spine works outside securities.

## Current public interfaces

- `POST /api/quick-review`
- `POST /api/matters/[id]/review`
- `POST /api/matters/[id]/chat`
- `GET /api/agents`
- `GET /api/matters/[id]/transcript?fmt=jsonl|json`
- `GET /api/matters/[id]/graph`
- `GET /api/matters/[id]/handoff?fmt=json|crumb`
- `GET /api/healthcheck`

## What was cannibalized natively

- The Brain: `MatterContextBundle` / demo case pack shape.
- Handoff format: sanitized text with citations, missing evidence, next actions,
  and approval state.
- PenguinWalkOS: smoke contract for deploy readiness.
- Claude Octopus: installed globally for Claude/Codex orchestration skills, no
  runtime dependency inside Compliance-AI.

## Runtime settings

Hosted preview:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
```

Private install:

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.1:8b
```

Legacy compatible:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Railway must probe `/api/healthcheck` and start with `pnpm start`.

## Demo readiness gate

Run:

```bash
pnpm install
pnpm test
pnpm -r typecheck
pnpm --filter @compliance-ai/web build
pnpm smoke:demo
```

`pnpm smoke:demo` verifies the route contract and a synthetic quick-review
upload. A deploy is not ready until that passes locally and against the public
Railway URL.

## Handoff export contents

The matter handoff contains:

- matter metadata
- document metadata
- chunks
- citations
- evidence
- audit entries
- transcript events
- graph summary
- approvals
- handoff-inspired sanitized text

## Operator talk track

"This is not a generic chat panel. The user drops a document and gets a cited
review package. Every claim has source context, every material gap becomes work,
and every step can be exported for the next reviewer or approver."

## Done state

- `/demo` loads and defaults to Securities Review.
- Upload creates a matter and lands on `/matters/[id]?autoStart=1`.
- Review/chat use the configured provider.
- Queue, approvals, controls, transcript, graph, and handoff routes load.
- Railway deploy is tied to `main`.
- Public smoke passes against the Railway preview URL.
