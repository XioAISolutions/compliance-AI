# XIO ProofOps Agent — Milan AI Week submission

This file is the submission copy. The longer architecture brief lives in
`HACKATHON_MILAN.md`.

## Submission line

**Most AI agents generate answers. XIO ProofOps generates defensible business evidence.**

## Tagline (≤ 100 chars)

Autonomous proof, approval, and audit trails for regulated business decisions.

## What it is (≤ 280 chars)

XIO ProofOps Agent turns decks, contracts, policies, and voice transcripts into risk-ranked findings, verified citations, redlined safer language, hash-bound human approvals, and a downloadable DOCX proof pack. Compliance teams ship evidence, not chat.

## Long description

Most AI agents generate text. Regulated teams cannot ship text. They need evidence the text can be reviewed, approved, defended, and audited months later.

XIO ProofOps Agent is an autonomous proof workflow built on top of the Compliance-AI platform. Drop a deck, contract, policy, or voice transcript and the agent:

1. Classifies the matter and selects review lanes (securities, privacy, marketing-signoff, AI-use, contract-redline).
2. Plans the reasoning path via the **Gemini planner** with structured-output JSON.
3. Runs a compliance reviewer over the lanes — finds guaranteed-outcome language, missing disclosures, consent gaps.
4. Scores cognitive manipulation with the **BrainSNN Cognitive Risk Agent** — emotional activation, certainty pressure, trust erosion, urgency compression. *Score is computed from the input text, not hard-coded — judges can paste their own copy on `/demo/milan` and watch it move.*
5. Verifies citations against the offline authority corpus and the CanLII heuristic.
6. Drafts safer-language redlines, optionally via a **Featherless** open-weights model for sovereign lanes.
7. Blocks export until human approval binds to `sha256(output)`.
8. Emits a downloadable DOCX proof pack: findings, redline summary, cognitive-risk receipt, output + approval hashes, audit trail.

Voice intelligence enters through **Speechmatics**: diarized sales / investor / compliance call transcripts feed the same proof workflow as written documents. The application runs as an enterprise compliance plane on **Vultr** — Next.js workload, regionally placed, healthchecked, deployable as a private install with all keys held by the firm.

## Demo URL

`https://<vultr-deploy>/demo/milan`

## Live endpoints judges can poke

| Endpoint | What it returns |
|---|---|
| `GET /demo/milan` | Judge surface — workflow timeline, BrainSNN risk bars, partner-status, interactive risk tester, download button. |
| `GET /api/demo/milan` | Deterministic JSON: scenario, 8-step workflow, findings, BrainSNN, partner statuses, proof-pack URL. |
| `POST /api/demo/milan/cognitive-risk` `{text}` | Live BrainSNN score over any pasted text. |
| `GET /api/demo/milan/plan` | Gemini-planned review lanes for the canonical scenario (deterministic fallback if `GEMINI_API_KEY` is unset). |
| `POST /api/demo/milan/plan` `{text}` | Gemini-planned review lanes over arbitrary text. |
| `GET /api/demo/milan/proof-pack` | Downloadable DOCX proof pack — the artifact judges walk away with. |
| `GET /matters/new` | Full matter wizard — the production review path the demo route summarizes. |

## Repository

Repo: `XioAISolutions/compliance-AI`
Branch: `feat/milan-proofops-agent`
Submission docs: `docs/HACKATHON_MILAN.md`, `docs/MILAN_SUBMISSION.md`

## Tech stack

- Next.js 16 (App Router, Turbopack)
- TypeScript, React 19, Tailwind v4
- Postgres (Drizzle ORM) + in-memory preview stores
- `docx` for OOXML proof-pack rendering
- Vitest (663 tests passing)
- nixpacks build, Railway/Vultr-deployable

## Partner-track integrations

| Partner | Mode | Activation |
|---|---|---|
| Vultr | Production cloud | Deploy reports live when `VULTR_DEPLOY` is set. |
| Gemini | Planner + multimodal reasoning | Live when `GEMINI_API_KEY` is set; falls back deterministically otherwise. Model override via `GEMINI_MODEL` (default `gemini-2.5-flash`). |
| Speechmatics | Voice intelligence | Live when `SPEECHMATICS_API_KEY` is set (audio-upload path coming in the credentialed next-pass). |
| Featherless | Open-weights inference | Live when `FEATHERLESS_API_KEY` is set. |

Without any keys the demo is still fully functional via the deterministic path — the smoke suite stays credential-free.

## Why we'll win

| Criterion | Evidence |
|---|---|
| **Application of technology** | Every partner has a concrete role and an env-var-driven live indicator on the page. Gemini-planned lanes, BrainSNN computed from text, Speechmatics-shaped transcript ingest, Featherless-routed redline lane, Vultr-hosted enterprise plane. |
| **Presentation** | Workflow timeline, not a chatbot. Interactive BrainSNN tester. Downloadable DOCX evidence. 90-second video storyboard in `HACKATHON_MILAN.md`. |
| **Business value / impact** | Regulated teams cannot ship AI output without a defensible audit trail. ProofOps is the proof chain. The DOCX pack is what a compliance officer actually keeps. |
| **Originality** | Approval-gated, hash-bound, audit-ready proof workflow with cognitive-risk scoring as a layer existing compliance products do not have. |
| **Technical implementation** | Next 16 build clean, 663 tests passing, smoke covers every Milan route including the DOCX binary, BrainSNN score derived from input text (not a constant). Graceful Gemini fallback so judges never see a 5xx. |

## What to record (90 seconds)

See the storyboard table in `HACKATHON_MILAN.md`. Record against the live Vultr URL.

## Submission line, again

**Most AI agents generate answers. XIO ProofOps generates defensible business evidence.**
