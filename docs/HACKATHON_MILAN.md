# XIO ProofOps Agent — Milan AI Week Hackathon

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

### Vultr

Production-shaped web-based enterprise agent. The application already has a Next.js web app, API routes, a monorepo build, health checks, and deployment hooks. The Milan route gives judges a single enterprise workflow surface.

### Gemini

Gemini is positioned as the planner and multimodal reasoning layer. It should be used to classify artifacts, plan review lanes, summarize transcript evidence, and explain why the proof run selected each agent.

### Speechmatics

Speechmatics fits as the voice-intelligence ingestion layer: sales calls, investor calls, compliance interviews, and advisor conversations become transcripts that the same proof workflow can evaluate.

Current Milan MVP supports transcript-shaped ingestion and deterministic sample output. A production integration should add audio upload, diarization, speaker attribution, and transcript confidence metadata.

### Featherless

Featherless fits as an open-source domain-review fallback for private deployments. The review system can run specialized models for lower-sensitivity claim extraction, redline drafting, or policy matching while the approval/export trail remains the same.

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

## Build acceptance checklist

- `/demo/milan` loads without credentials.
- `/api/demo/milan` returns deterministic JSON for smoke tests and judges.
- The page explains the whole product in under 30 seconds.
- The page shows a multi-agent timeline rather than a chat box.
- BrainSNN is framed as a cognitive-risk agent inside the compliance workflow.
- Partner fit is explicit for Vultr, Gemini, Speechmatics, and Featherless.
- Export remains framed as approval-gated and audit-ready.

## What this PR delivers

- `/demo/milan` judge surface with the 8-step proof workflow, BrainSNN risk layer, findings, partner-fit cards, and proof-pack summary.
- `/api/demo/milan` deterministic JSON for smoke tests and judges.
- Milan ProofOps link wired into the root cockpit (`HomeCockpit.tsx`).
- Milan route coverage in `scripts/smoke-demo.mjs` (page + API contract: product, 8 workflow steps, partner-fit keys, BrainSNN score).
- This submission brief.

## Next build pass

1. Add a transcript paste/upload path in the real matter wizard.
2. Add a Gemini planner provider wrapper.
3. Add a Speechmatics adapter boundary.
4. Add a real BrainSNN scoring helper that can run over claims and transcript excerpts.
