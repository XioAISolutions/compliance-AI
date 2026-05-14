# XIO ProofOps Agent — Milan AI Week Hackathon

## Live deploy

**`https://xio-proofops.45.76.80.253.sslip.io/demo/milan`** — set `GEMINI_API_KEY`, `FEATHERLESS_API_KEY`, `SPEECHMATICS_API_KEY`, and `VULTR_DEPLOY=1` on the host to activate the partner-backed route paths where the sponsor accounts allow API access.

## Submission line

**Most AI agents generate answers. XIO ProofOps generates defensible business evidence.**

XIO ProofOps Agent is an autonomous proof, approval, and audit-trail workflow for regulated business decisions. It turns decks, contracts, policies, marketing claims, and voice transcripts into risk-ranked findings, verified citations, safer redlines, human approval records, and export-ready proof packs.

## Why this exists

Regulated teams do not just need faster drafting. They need evidence that the draft can be trusted, reviewed, approved, and defended later. A chatbot can write a memo. XIO ProofOps creates the proof chain around the memo.

## What the judge should open

- Demo route: `/demo/milan`
- Deterministic workflow API: `/api/demo/milan`
- Existing full matter flow: `/matters/new`

## Demo scenario

The canned Milan run reviews an investor deck, a sales-call transcript, and a risky marketing claim:

> Protected returns, limited spots, AI-reviewed onboarding, and instant approval.

The agent classifies the matter into securities, privacy, marketing-signoff, and AI-use review lanes. It then runs a multi-agent workflow and blocks export until approval binds to the output hash.

## Agent workflow

1. **Intake Agent** — loads documents, deck text, and voice transcript into one matter context.
2. **Gemini Planner** — selects review lanes and plans the reasoning path.
3. **Compliance Reviewer** — finds guaranteed-outcome language, missing disclosures, and consent gaps.
4. **BrainSNN Cognitive Risk Agent** — scores what the content is doing to judgment: urgency, certainty, fear, pressure, trust erosion.
5. **Citation Verifier** — verifies authority references and marks weak claims for manual review.
6. **Redline Agent** — rewrites risky claims into safer language.
7. **Approval Gate** — blocks export until human approval is bound to `sha256(output)`.
8. **Export Agent** — queues DOCX proof pack, transcript appendix, citation ledger, and audit trail.

## Partner-category fit

### Vultr — production cloud

Enterprise-grade Next.js workload: regionally placed, healthchecked (`/api/healthcheck`), nixpacks-built, deployable as a private compliance plane. The Milan submission ships as a real production URL on Vultr — judges can pull the live route, not just a screenshot.

### Gemini — planner and multimodal reasoning

Gemini drives the planner step: structured-output JSON for review-lane selection, grounded analysis over deck text + transcript context, and rationales that get carried into the audit trail. Multimodal capability is what lets the same agent ingest a PDF deck and a transcript paragraph in one call.

### Speechmatics — voice intelligence

Speechmatics ingests sales, investor, and compliance calls. Diarized transcripts with confidence metadata feed the same proof workflow as written documents — so a regulator-relevant statement made on a sales call gets the same compliance + cognitive-risk treatment as one in a deck.

Current Milan MVP exercises the deterministic transcript path. A production integration adds direct audio upload, speaker attribution, and per-utterance confidence carried into the proof pack.

### Featherless — open-weights inference for sovereign lanes

Featherless serves open-weights review models on demand. Firms that cannot send claim text to a closed API (sealed proceedings, privileged matters, EU-residency mandates) route the Redline Agent and the domain reviewer through Featherless while keeping the same approval gate and audit trail. The proof pack records *which* model produced *which* output, so the evidence chain is intact even when the inference layer rotates.

## Why Compliance-AI is the base

The existing platform already has the hard parts a hackathon judge can believe:

- matter creation and review workflow
- task-specific reviewer personas
- source packs
- structured citation provenance
- citation verification
- redline export
- hash-bound approvals
- audit trail
- DOCX work-product output

The Milan submission should not start a new repository. It should add a judge-ready ProofOps surface to the existing product.

## Why BrainSNN belongs inside the product

BrainSNN is the differentiator, not the base. Compliance-AI proves whether a claim is allowed. BrainSNN proves what the claim is doing to the reader's judgment.

In the Milan submission, BrainSNN appears as the **Cognitive Risk Agent**:

- emotional activation
- certainty pressure
- trust erosion
- urgency compression
- manipulation pressure
- investor hype
- aggressive sales language

This turns the project from a legal app into a broader enterprise proof system for regulated content.

## What to say in the video

> AI agents are easy to demo when nothing matters. They are hard to trust when the output becomes evidence. XIO ProofOps solves that.
>
> We upload an investor deck and sales-call transcript. The agent classifies the risk, plans the review, checks the claims, scores cognitive manipulation, verifies citations, proposes safer redlines, and blocks export until human approval binds to the exact output hash.
>
> This is not chat. This is autonomous proof work.

## 90-second video storyboard

| Time | Beat | What the viewer sees |
|---|---|---|
| 0:00 – 0:05 | Thesis card | Black slide: *"Most AI agents generate answers. XIO ProofOps generates defensible business evidence."* |
| 0:05 – 0:15 | The matter | `/demo/milan` hero — deck + transcript + marketing claim loaded as artifacts. Cognitive-risk metric ticks up. |
| 0:15 – 0:45 | The workflow runs | Camera pans down the 8-step timeline. Intake → Gemini Planner → Compliance Reviewer → BrainSNN → Citation Verifier → Redline → Approval Gate → Export. Each step's signal chip lights. |
| 0:45 – 1:00 | The risk receipt | Close-up on the BrainSNN bars — emotional activation, certainty pressure, trust erosion, urgency compression. *"Compliance checks legality. BrainSNN checks what the message does to judgment."* |
| 1:00 – 1:15 | The gate holds | Click "Open full matter wizard" → try to export → 403, hash-bound approval required. Approver signs. Hash binds. |
| 1:15 – 1:25 | The artifact | "Download proof pack (.docx)" — DOCX opens: findings, redline summary, cognitive-risk receipt, approval hash, audit trail. |
| 1:25 – 1:30 | Submission line | Close on: *"Most AI agents generate answers. XIO ProofOps generates defensible business evidence."* |

Record against the live Vultr URL, not localhost. No talking-head intro.

## Judging-criteria mapping

How each piece of the submission lands against the standard lablab.ai rubric:

| Criterion | Where it shows up |
|---|---|
| **Application of technology** | Every partner has a concrete role in the workflow (Vultr deploy, Gemini planner, Speechmatics transcript ingest, Featherless sovereign-lane inference). Partner-fit cards on `/demo/milan` and the proof-pack DOCX both name the partner. |
| **Presentation** | `/demo/milan` is shaped as a workflow timeline, not a chatbot. 90-second video follows the storyboard above. Submission line is consistent across page, doc, and DOCX. |
| **Business value / impact** | Regulated industries cannot ship AI output without evidence the output can be defended. ProofOps is the proof chain, not the draft. The DOCX proof pack is the shipping artifact a compliance officer would actually keep. |
| **Originality** | The thesis is the differentiator. Most hackathon entries are "chat with X" — this is "approval-gated, hash-bound, audit-ready proof workflow," with cognitive-risk scoring as a layer existing compliance products do not have. |
| **Technical implementation** | Builds cleanly on Next 16, 682 unit tests pass, smoke covers `/demo/milan`, `/api/demo/milan`, and `/api/demo/milan/proof-pack`. BrainSNN score is derived from text via `computeCognitiveRisk` — a judge opening devtools can see real computation, not a constant. Approval gate is wired and tested. |

## Build acceptance checklist

- `/demo/milan` loads without credentials.
- `/api/demo/milan` returns deterministic JSON for smoke tests and judges.
- The page explains the whole product in under 30 seconds.
- The page shows a multi-agent timeline rather than a chat box.
- BrainSNN is framed as a cognitive-risk agent inside the compliance workflow.
- Partner fit is explicit for Vultr, Gemini, Speechmatics, and Featherless.
- Export remains framed as approval-gated and audit-ready.

## What this PR delivers

- `/demo/milan` judge surface with the 8-step proof workflow, BrainSNN risk layer, findings, partner-fit cards, and proof-pack download.
- `/api/demo/milan` deterministic JSON for smoke tests and judges.
- `/api/demo/milan/proof-pack` downloadable DOCX proof pack — the artifact judges walk away with.
- `computeCognitiveRisk(text)` helper (`apps/web/src/lib/demo/cognitive-risk.ts`): lexical scoring of urgency / certainty / trust erosion / emotional activation, with covering tests. BrainSNN score on the page and in the API is now *derived* from the canonical scenario text, not hard-coded.
- Milan ProofOps link wired into the root cockpit (`HomeCockpit.tsx`).
- Milan route coverage in `scripts/smoke-demo.mjs` — page, JSON contract (product, 8 steps, partner-fit keys, derived BrainSNN score, dimensions, proof-pack URL), and DOCX download (content-type, filename, size).
- Submission brief, 90-second video storyboard, and judging-criteria mapping (this doc).

## What this PR delivers — partner integrations

All four sponsor tracks now have live, env-gated providers with graceful deterministic fallback:

| Partner | Endpoint | Env vars | Live when set |
|---|---|---|---|
| **Gemini** | `GET\|POST /api/demo/milan/plan` | `GEMINI_API_KEY` (+ optional `GEMINI_MODEL`) | Planner returns `source: "gemini"` with structured-output JSON. Bad responses / 4xx / 5xx / timeout fall back to deterministic with the error captured. |
| **Featherless** | `GET\|POST /api/demo/milan/redline` | `FEATHERLESS_API_KEY` (+ `FEATHERLESS_MODEL`, `FEATHERLESS_BASE_URL`) | Redline drafter returns `source: "featherless"`. Same fallback contract. |
| **Speechmatics** | `GET /api/demo/milan/transcribe` | `SPEECHMATICS_API_KEY` (+ `SPEECHMATICS_BASE_URL`) | Auth-ping against `/v2/jobs` runs per request; response carries `auth.{ok,status,error,latencyMs}` and `source: "speechmatics"` when verified. |
| **Vultr** | (hosting — no runtime API call) | `VULTR_DEPLOY` or `VULTR_API_KEY` | Partner row lights up. Vultr's control-plane key is NEVER called from request handlers — keep it in CI / deploy tooling only. |

The DOCX proof pack rolls each partner's live output into the artifact (plan section labels the model + latency, redline section pairs before/after with the model that drafted it, transcript section reports auth status). `X-ProofPack-{Plan,Redline,Transcript}-Source` headers expose the same info to curl.

## Next build pass

1. Speechmatics live audio upload + batch-job polling (right now we ship the auth-ping path and the canonical transcript; the upload UI is the credentialed next pass).
2. Vultr autoscaling / multi-region deploy story written up in `docs/DEPLOY_VULTR.md`.
3. Production OAuth + tenant isolation hardening (out of scope for the hackathon window).
