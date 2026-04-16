# Codex handoff — Railway deploy for XIO Compliance Brain

## Context

The 4+2-layer plan (`/root/.claude/plans/sharded-fluttering-donut.md`) is
complete and merged to `main`. Every layer has been propagated to the
`demo/product-launch-layer` branch which Railway deploys from, so the
preview at `compliance-ai-preview-production.up.railway.app` already has
the full stack. **However**, the preview is running in anonymous preview
mode (no `DATABASE_URL`, no `NEXTAUTH_SECRET`, no `ANTHROPIC_API_KEY`
confirmed), which means:

- All state is in-memory and wiped on cold start
- Every request is served as a synthetic "preview" session
- Reviews may fail with a 500 if `ANTHROPIC_API_KEY` isn't set
- Citations now flow correctly through the UI **as of Layer 6** (previous
  deploys rendered `[c1]` literals with no footnotes)

This document is a step-by-step handoff so Codex (or the on-call human)
can turn the preview into a real production deploy without guessing.

Outcome if everything here succeeds: a prospect drops an OM on the
preview URL, logs in via email or OAuth, sees their matter persist
across restarts, gets a citation-backed review with superscripts + DOCX
exhibits, and has their audit trail hash-chained in Postgres.

## Prerequisites

- Railway project with the `compliance-ai-preview-production` service
  currently deployed from `demo/product-launch-layer`
- An Anthropic API key with Sonnet 4.6 access
- A Postgres add-on (Railway provides one-click) OR an existing Postgres
  connection string you trust
- Optional: GitHub OAuth app credentials if you want social sign-in

## Step 1 — Provision Postgres

In the Railway dashboard:

1. Open the `compliance-ai-preview-production` project
2. Click **+ New** → **Database** → **PostgreSQL**
3. Railway creates the DB and auto-injects `DATABASE_URL` into the
   web service. Verify in the service's **Variables** tab that
   `DATABASE_URL` is present and starts with `postgres://`

## Step 2 — Set required env vars

In the web service's **Variables** tab, set:

| Variable | Value | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Required; reviewer fails without it |
| `NEXTAUTH_SECRET` | `$(openssl rand -base64 32)` | Flip to "real auth" mode |
| `NEXTAUTH_URL` | `https://compliance-ai-preview-production.up.railway.app` | Must match the deployed URL exactly |
| `AUTH_GITHUB_ID` | *(optional)* | Activates GitHub sign-in |
| `AUTH_GITHUB_SECRET` | *(optional)* | |
| `AUTH_GOOGLE_ID` | *(optional)* | Activates Google sign-in |
| `AUTH_GOOGLE_SECRET` | *(optional)* | |

`DATABASE_URL` is already injected by the Postgres add-on from Step 1.

If only `ANTHROPIC_API_KEY` is set (no DB, no auth), the service stays
in preview mode but reviews will now actually run. That's a valid demo
configuration — skip to Step 5 if you want that.

## Step 3 — Run Drizzle migrations against Railway Postgres

The schema lives in `packages/db/migrations/0000_lethal_mandroid.sql`
(13 tables, 15 enums, 18 indexes). Apply it:

### Option A — via `drizzle-kit migrate` from local terminal

```bash
# Copy Railway's DATABASE_URL to your clipboard (Variables tab → copy)
export DATABASE_URL="postgres://..."
cd /path/to/compliance-AI
pnpm install
pnpm --filter @compliance-ai/db db:migrate
```

Drizzle reads the migration file and applies it in a transaction. Safe
to re-run — no-op if already applied.

### Option B — via Railway CLI

```bash
railway login
railway link   # select compliance-ai-preview-production
railway run --service web pnpm --filter @compliance-ai/db db:migrate
```

### Option C — via `psql` directly

```bash
# Only if the above two options aren't available
psql "$DATABASE_URL" -f packages/db/migrations/0000_lethal_mandroid.sql
```

## Step 4 — Apply RLS policies

Row-Level Security enforces per-tenant isolation. The policies live in
`packages/db/rls/policies.sql` (9 tables: organizations, users, controls,
control_revisions, cognition_items, matters, matter_documents,
document_chunks, audit_log, evidence_items). Apply with psql:

```bash
psql "$DATABASE_URL" -f packages/db/rls/policies.sql
```

This is **required if `NEXTAUTH_SECRET` is set** — without RLS applied,
the `withOrg()` helper will run `SET LOCAL app.org_id` but no policy
filters queries, so tenant isolation is lost.

If you skipped auth (preview mode only), RLS is optional — the app
sends `organizationId = "preview"` and no multi-tenant queries happen.

## Step 5 — Redeploy

Railway auto-deploys on each push to `demo/product-launch-layer`. To
force a redeploy after changing env vars:

1. Service → **Deployments** tab → **Redeploy** on the latest build

The service boots in ~30-60 seconds. Watch the logs for:

```
▲ Next.js 16.2.3
- Local:   https://compliance-ai-preview-production.up.railway.app
- Ready in XXXms
```

## Step 6 — Smoke test

Exercise the critical path. Each check here verifies one load-bearing
layer.

### 6.1 — Healthcheck

```bash
curl https://compliance-ai-preview-production.up.railway.app/api/healthcheck | jq
```

Expected (DB-configured mode):

```json
{
  "status": "ok",
  "uptime": 42,
  "checks": {
    "cognition": { "ok": true, "size": 16 },
    "database":  { "ok": true, "configured": true },
    "auth":      { "configured": true }
  },
  "version": "0.8.0",
  "timestamp": "..."
}
```

A `"ok": false` on database means the migration didn't apply. Go back
to Step 3.

### 6.2 — Home page drop-zone flow (the hero demo)

1. Open the preview URL in an incognito window
2. If auth is configured, sign in via Credentials (email) — first
   sign-in redirects to `/onboarding`; set org name, jurisdiction,
   registration category. This creates the tenant and seeds its
   authority corpus.
3. Land on the home page. Drop a real OM PDF on the hero drop zone.
4. Expect: "Classified as Offering memo review. Opening matter…"
5. Redirect to `/matters/<uuid>?autoStart=1`
6. The review should auto-start. Within 10-15 seconds you should see:
   - Checklist table streaming in
   - Gap memo paragraphs
   - Risk flags section
   - **Amber `[c1]`, `[c2]` superscripts** in the prose (not literal
     text — that was Layer 6)
   - **Citations footnote panel** populated on the right
   - Judge verdict badge (READY_TO_SUBMIT / ITERATE / REWRITE)

### 6.3 — Citation hover + click

Hover a `[c1]` superscript. A tooltip should show `authorityId § section`.
Click it — the page scrolls to the corresponding footnote entry.

### 6.4 — DOCX export

Click **Export DOCX**. Open the downloaded file. Expect:
- Title page with matter name + task type + jurisdiction
- Body with formatted tables, bullets, and **citation superscripts in amber**
- **Exhibits appendix** with one entry per citation, showing the
  quoted text + authority § section

### 6.5 — Persistence across restart

With auth configured:
1. Create a matter, upload a doc, run a review
2. In Railway, click **Redeploy** on the service
3. After redeploy finishes (~60 sec), refresh the matter page
4. Expect the matter, document, chunks, audit entries, and evidence
   items to all still be present

If any of them are missing, DB wiring failed — check logs for
Drizzle connection errors.

### 6.6 — Audit trail verification

Open a matter detail page, click **Audit trail** in the top bar. Expect:
- Query entry (from quick-review)
- Retrieval entry
- Generation entry with `outputContent` showing the **clean final prose**
  (no `` ```citations `` fence, no judge rationale leaking in)
- If evidence items exist: a second retrieval entry for auto-extract
- **Chain verified** badge (green dot)

### 6.7 — Approval flow (optional)

When a review hits READY_TO_SUBMIT:
1. Scroll to the output pane, click **Request approval** (if implemented
   inline; otherwise POST to `/api/approvals`)
2. Open `/approvals` as an owner/admin
3. See the pending request, click **Approve** with a rationale
4. Audit trail shows two new entries: `APPROVAL_REQUESTED` and
   `APPROVAL_APPROVED`

## Step 7 — Configure custom domain (optional)

Railway supports custom domains. If you want `app.xioai.com`:

1. Service → **Settings** → **Networking** → **Custom Domain**
2. Add your domain; Railway gives you a CNAME target
3. Update DNS with the CNAME
4. Update `NEXTAUTH_URL` env var to match
5. Redeploy

## Troubleshooting

### Review times out / produces nothing

- Check `ANTHROPIC_API_KEY` is set and valid
- Check logs for `ANTHROPIC_API_KEY is not set` errors (should be a
  5-line stack trace; if present, env var didn't propagate to the
  runtime)
- The Anthropic API might be slow/flaky — retry once

### "Matter not found" after creating one

- Preview mode (no `DATABASE_URL`): matters are in-memory and reset on
  cold starts. Expected.
- DB mode: check RLS policies are applied. `withOrg` will return 0 rows
  if the org_id session variable doesn't match a policy.

### Sign-in fails

- `NEXTAUTH_URL` must match the deployed URL exactly (incl. https://)
- GitHub OAuth callback URL in the GitHub App should be
  `${NEXTAUTH_URL}/api/auth/callback/github`

### Citations still not rendering

- Verify you're on the latest deploy (Layer 6 merged the fix)
- Open DevTools → Network → watch the `/api/matters/<id>/review`
  response. Look for `data: {"type":"citations", ...}` frames right
  before `data: {"type":"loop-done", ...}`
- If the `citations` frame is absent, the reviewer's output didn't
  include a `` ```citations `` JSON fence — that's the model's output
  drift, not a code bug. Check the persona system prompt includes
  `CITATION_INSTRUCTION`.

### Build fails on Railway

- `pnpm-lock.yaml` must be committed
- Railway uses `pnpm install --frozen-lockfile` — if the lockfile is
  out of sync with `package.json`, the build fails. Run `pnpm install`
  locally, commit the updated lockfile, push.
- Node version: the `engines.node` field in root `package.json` is
  `>=20.0.0`. Railway defaults to Node 20+.

### Migration fails with "permission denied for schema public"

Some Railway Postgres variants require an explicit schema grant:

```bash
psql "$DATABASE_URL" -c "GRANT ALL ON SCHEMA public TO CURRENT_USER;"
```

Then re-run the migration.

## What the deployment does NOT include (future work)

These were out of scope for the 4+2-layer plan:

- **pgvector semantic retrieval** — currently using lexical (Jaccard).
  Works but retrieval quality is limited. Upgrading requires enabling
  the pgvector extension, backfilling embeddings for existing cognition
  items, and swapping `InMemoryCognitionStore` for a Postgres-backed
  impl. See `docs/redesign.md` "Build after" section.
- **S3/R2 storage for original files** — documents are parsed and
  chunked; the raw PDF is not retained. If a client wants deep-links
  to the PDF page, add an upload-to-S3 step in `/api/quick-review`.
- **Email magic-link auth** — the credentials provider signs in by
  email only for demo simplicity. For production, wire NextAuth's
  Email provider with SMTP (Resend, Postmark, SES).
- **Per-doc PDF viewer** — citation click currently scrolls to the
  footnote; a fuller implementation would embed a PDF viewer scrolled
  to the cited page.

## Summary checklist

- [ ] Railway Postgres provisioned; `DATABASE_URL` injected
- [ ] `ANTHROPIC_API_KEY` set
- [ ] `NEXTAUTH_SECRET` set (32+ random bytes)
- [ ] `NEXTAUTH_URL` matches deployed URL
- [ ] Drizzle migrations applied (`db:migrate`)
- [ ] RLS policies applied (`policies.sql`)
- [ ] Redeploy triggered
- [ ] `/api/healthcheck` returns `status: ok` with DB + auth configured
- [ ] Drop-zone quick-review flow works end-to-end
- [ ] Citations render as superscripts + footnotes
- [ ] DOCX export has Exhibits appendix
- [ ] Matter persists across redeploy
- [ ] Audit trail verifies cleanly

Time estimate: 20-30 minutes for someone who has Railway + Postgres
familiarity, 60-90 for a first-timer.
