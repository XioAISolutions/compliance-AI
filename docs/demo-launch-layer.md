# Compliance-AI demo cockpit layer

The demo layer is now a single cockpit at `/demo`, not a standalone obsolete
surface. It has two tabs:

- **Securities Review** - primary path for offering memoranda, KYC/AML files,
  marketing material, and regulator-response memos.
- **Infosec GRC** - secondary path using deterministic assessment, controls,
  evidence, and risk queue logic.

## Securities path

1. Drop a TXT/PDF/DOCX into the quick-review zone.
2. `/api/quick-review` parses, chunks, classifies, creates a matter, stores the
   document, and appends an audit entry.
3. The client navigates to `/matters/[id]?autoStart=1`.
4. Review streams into the output pane with citation superscripts, a footnote
   panel, judge verdicts, and export actions.
5. Transcript and graph tabs expose the agent timeline and evidence map.
6. Handoff export produces a native JSON bundle plus sanitized CRUMB-style text.

## Infosec path

The second tab reuses `apps/web/src/lib/demo`:

- deterministic assessment
- evidence requests
- control queue scoring
- launch checklist
- shared queue/approval/audit patterns

This proves the compliance engine generalizes, while the live talk track stays
on the stronger securities story.

## Public contract

- `POST /api/quick-review`
- `POST /api/matters/[id]/review`
- `POST /api/matters/[id]/chat`
- `GET /api/agents`
- `GET /api/matters/[id]/transcript?fmt=jsonl|json`
- `GET /api/matters/[id]/graph`
- `GET /api/matters/[id]/handoff?fmt=json|crumb`
- `GET /api/healthcheck`

## Smoke contract

Before deploy, these must pass:

```bash
pnpm install
pnpm test
pnpm -r typecheck
pnpm --filter @compliance-ai/web build
pnpm smoke:demo
```

`pnpm smoke:demo` validates `/`, `/demo`, `/matters`, `/queue`, `/approvals`,
`/controls`, `/api/healthcheck`, `/api/agents`, and a synthetic quick-review
upload that creates a matter, transcript, graph, and handoff.

## Runtime posture

- Hosted preview uses OpenAI when `LLM_PROVIDER=openai` and `OPENAI_API_KEY` are set.
- Private/local installs can use Ollama with `LLM_PROVIDER=ollama`.
- Legacy Anthropic deployments still work with `LLM_PROVIDER=anthropic`.
- No QPanda/OriginQ runtime is required; deterministic prioritization remains
  the active queue engine.
