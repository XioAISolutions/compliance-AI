# Codex handoff - Railway deploy for XIO Compliance Brain

## Goal

Deploy the demo cockpit layer to the existing Railway service:

- Project: `penguinwalk`
- Environment: `production`
- Service: `compliance-ai-preview`
- Preview URL: `https://compliance-ai-preview-production.up.railway.app`

The deploy is ready when `/demo` opens, quick-review creates a matter, review
can stream with the configured provider, transcript and graph routes load, and
the handoff export is available.

## What is in this branch

- `/demo` cockpit with Securities Review as the main path and Infosec GRC as the second tab.
- Quick-review upload: parse, classify, chunk, create matter, audit, redirect.
- Matter transcript, agent registry, evidence graph, and handoff exports.
- BM25 + RRF hybrid retrieval in the in-memory cognition store.
- Railway config using `/api/healthcheck` and the root `pnpm start` command.
- Provider runtime for `openai`, `ollama`, and legacy `anthropic`.
- Smoke contract in `scripts/smoke-demo.mjs`.

## Required Railway variables

Minimum hosted preview:

| Variable | Value | Notes |
| --- | --- | --- |
| `LLM_PROVIDER` | `openai` | Hosted preview mode |
| `OPENAI_API_KEY` | `sk-...` | Required for review/chat generation |
| `OPENAI_MODEL` | `gpt-5.4-mini` | Override if needed |
| `NEXTAUTH_URL` | `https://compliance-ai-preview-production.up.railway.app` | Must match deployed URL |

Optional production hardening:

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Railway Postgres URL | Enables persistence |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Enables real auth gating |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | OAuth app values | Optional GitHub sign-in |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | OAuth app values | Optional Google sign-in |

Private/local install:

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=llama3.1:8b
```

Legacy Anthropic install:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

## Database setup

Preview mode works without a database. For persisted production mode:

```bash
export DATABASE_URL="postgres://..."
pnpm install
pnpm --filter @compliance-ai/db db:migrate
psql "$DATABASE_URL" -f packages/db/rls/policies.sql
```

If using Railway Postgres, confirm `DATABASE_URL` is injected into the web
service before running migrations.

## Deploy

From `/Users/slavaz/compliance-AI`:

```bash
railway status
railway up --ci -s compliance-ai-preview --message "demo cockpit handoff"
```

`railway.json` points the healthcheck at `/api/healthcheck`. `nixpacks.toml`
builds `@compliance-ai/web`; the root `start` script binds Next to `0.0.0.0`.

## Smoke test

Local production smoke:

```bash
pnpm --filter @compliance-ai/web build
pnpm start
pnpm smoke:demo
```

Deployed smoke:

```bash
DEMO_BASE_URL=https://compliance-ai-preview-production.up.railway.app pnpm smoke:demo
```

Manual checks:

1. Open `/demo`; Securities Review is the default tab.
2. Drop a sample offering memorandum TXT/PDF/DOCX.
3. Confirm redirect to `/matters/[id]?autoStart=1`.
4. Start or observe review streaming.
5. Open Timeline and Graph.
6. Export handoff from `/api/matters/[id]/handoff?fmt=crumb`.
7. Open `/queue`, `/approvals`, and `/controls`.
8. Confirm `/api/healthcheck` returns `status: ok`.

## Troubleshooting

- 404 on `/demo` or `/api/healthcheck`: Railway is not running the latest build.
- Healthcheck degraded provider: `LLM_PROVIDER=openai` is set without `OPENAI_API_KEY`,
  or the provider name is invalid.
- Review generation error in preview: set the matching provider key or switch to
  `LLM_PROVIDER=ollama` only when an Ollama service is actually reachable.
- Matter disappears after restart: expected in preview mode without `DATABASE_URL`.
- Auth redirects unexpectedly: unset `NEXTAUTH_SECRET` for anonymous preview mode,
  or complete onboarding after enabling real auth.
- Railway deploy fails before build: run `pnpm install`, commit lockfile changes,
  and redeploy.

## Done means

- Code merged to `main`.
- GitHub `main` pushed.
- Railway deploy completed.
- Public smoke passes for `/`, `/demo`, `/matters`, `/queue`, `/approvals`,
  `/controls`, `/api/healthcheck`, `/api/agents`, and quick-review upload.
- `output/pdf/compliance-ai-demo-handoff.pdf` exists as the demo handoff artifact.
