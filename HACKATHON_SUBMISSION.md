# XIO Compliance Brain — AMD Developer Hackathon submission

Project title — **XIO Compliance Brain**
Differentiator — **Triad Review Engine for audit-ready compliance work**
Tagline — **Three AI reviewers. Verified citations. Audit-ready decisions.**

🌐 **Live (AMD MI300X-backed):** https://compliance-ai-amd-demo-production.up.railway.app
🩺 **Liveness:** https://compliance-ai-amd-demo-production.up.railway.app/api/healthcheck/llm
🎯 **90-second judge demo:** https://compliance-ai-amd-demo-production.up.railway.app/demo/judge
📦 **Source:** https://github.com/XioAISolutions/compliance-AI/pull/56
📄 **Pitch deck (PDF, 190 KB):** [`output/hackathon/pitch-deck.marp.pdf`](output/hackathon/pitch-deck.marp.pdf)

---

## Short description (≤ 255 characters)

XIO Compliance Brain is a Triad Review Engine for audit-ready legal and
compliance work. Three AI reviewers — Counsel, Risk, and Evidence — find
gaps, verify citations, expose disagreement, and produce approval-ready
output on a single AMD MI300X.

## Long description (≥ 100 words)

XIO Compliance Brain helps lawyers, compliance officers, and regulated
businesses review high-stakes documents — offering memoranda, KYC files,
marketing decks, regulator letters, privacy memos, and contract clauses.

Instead of producing one opaque chatbot answer (the failure mode of every
generic legal-AI demo), it runs **three AI reviewer perspectives in
parallel** against the same matter:

- **Regulatory Counsel** — finds rule breaches, missing disclosures, and
  jurisdiction issues
- **Risk Officer** — scores severity, investor exposure, and operational
  risk
- **Evidence Auditor** — verifies citations, flags stale or jurisdictionally
  mismatched authorities, and refuses to sign off on unsupported claims

The system then runs a synthesis pass that surfaces where the reviewers
agreed, where they diverged, and what the human owner should do next. An
optional Round 2 has each voice defend, update, or concede their stance
based on the others — a literal demonstration of multi-pass deliberation.

Every finding cites a retrieved authority. Outputs are bound to a SHA-256
hash before approval; export of DOCX, redline, and CRUMB-style audit
handoff packs is gated on hash-confirmed sign-off. The audit trail records
which inference engine served the matter, so a review run today on AMD/Qwen
has the same audit shape as one tomorrow on OpenAI.

Built for the AMD Developer Hackathon, the project demonstrates how
large-memory GPU serving on AMD Instinct MI300X (192 GB HBM3) supports
multi-pass agentic review workflows that cloud APIs would price out of
reach. The same Triad Review pipeline runs on a single MI300X serving Qwen
2.5 72B — three voices + synthesis + optional Round 2 on one GPU.

## How does it scale

A single MI300X (192 GB HBM3, 5.3 TB/s) hosts Qwen 2.5 72B at full FP16
precision and serves a three-voice ensemble plus synthesis on a single
card — demonstrating that real GPU memory headroom unlocks ensemble
strategies that cloud APIs price out of reach (~$8 cloud vs ≈$0.04
self-hosted per Triad Review).

To scale: add MI300X nodes behind a vLLM gateway, route per-tenant via
the existing `organizationId` scope, and shard the cognition store along
the same axis. The provider abstraction is env-flippable, so multi-tenant
deployments can mix self-hosted Qwen with cloud providers per regulatory
jurisdiction. A token-bucket rate limit ships as a first-class primitive
so the cost ceiling is bounded.

## Tech stack tags

AMD Instinct MI300X · vLLM · Qwen 2.5 72B · ROCm 7.0 · Next.js 15 ·
TypeScript · React 19 · Tailwind v4 · PostgreSQL · Drizzle ORM ·
Server-Sent Events · Vitest · NI 45-106 corpus

## 90-second judge demo path

1. Open the live URL.
2. Click **Run 90-second judge demo** (or visit `/demo/judge` directly).
3. Read the seeded Ontario OM matter — score, gaps, citations, disagreement.
4. Inspect the citation verification badges (verified / needs-check /
   missing / stale / jurisdiction-mismatch).
5. Read the **Where reviewers disagreed** panel — Counsel vs. Risk vs.
   Evidence on the past-performance language, with a final action.
6. Read the **Approval required before export** panel — output hash,
   reviewer status, export blocked.
7. Click **Download CRUMB handoff pack** to see the audit-pack format the
   production matters export.

For a live debate run with real model inference: visit `/demo/debate` and
click **Run debate** on any of the four templates.

## Demo script (≈ 3 minutes)

> Most legal AI tools give one confident answer. That's dangerous in
> compliance.
>
> XIO Compliance Brain runs three AI reviewers over the same matter:
> **Regulatory Counsel**, **Risk Officer**, and **Evidence Auditor**.
>
> Here's an Ontario offering memorandum review the system just ran. The
> compliance score is 62%, and there are three critical gaps: an
> unsubstantiated past-performance claim, an unspecific use-of-proceeds
> disclosure, and a rights-of-action statement that needs manual
> confirmation.
>
> Look at the citation badges — five verified citations, two needing
> manual check, and one that's flagged jurisdiction-mismatch because the
> authority is BC-specific and the matter is Ontario.
>
> Now the interesting part: the **disagreement panel**. Counsel says the
> performance claim is too promotional. Risk says it's high-impact because
> investors will rely on it. Evidence says it can't stand without
> verifiable benchmark methodology. The synthesis lands a final action:
> rewrite the claim with a benchmarked, period-bounded calculation.
>
> Now the gate. The output is bound to this exact SHA-256 hash. Export
> DOCX is blocked. Export redline is blocked. Only the read-only CRUMB
> handoff pack is available — the audit trail of what was reviewed and
> by whom.
>
> All of this runs on a single AMD Instinct MI300X — Qwen 2.5 72B,
> three reviewer perspectives, synthesis, and optional Round 2 — on one
> GPU. That's not just an AI answer. It's audit-ready compliance work
> product.

## Hackathon judging rubric — how the four criteria map

**Application of Technology** — three voices + synthesis + optional Round 2
all serve concurrently against ONE Qwen 2.5 72B endpoint on ONE MI300X.
192 GB HBM3 makes the ensemble fit; cloud APIs would need ≈4× H100s for
the same workload. Live `/api/healthcheck/llm` reports model context
window, tokens-per-second, and live engine activity (running requests,
queue depth, lifetime tokens served).

**Originality** — multi-voice debate against a single endpoint is uncommon.
Synthesis turning three blobs of dense markdown into one decision-grade
verdict is uncommon. Round-2 follow-up where voices defend / update /
concede their stance based on the others is, as far as we can find,
unique. Permalinks encode full debate output (verdict + voices + Round 2)
into a URL hash for share-without-DB.

**Business Value** — Canadian securities/regulatory compliance is a real
money-on-the-line vertical. Real NI 45-106 / OSC Rule 45-501 / NI 31-103
corpus. Citation-grade receipts. CRUMB handoff records which provider
served the matter — audit trails reproducible across provider changes.
ROI panel on the homepage shows order-of-magnitude unit economics
(≈ $0.04 self-hosted vs ≈ $8.10 cloud per Triad Review).

**Presentation** — `/demo/judge` is a one-click 90-second seeded review;
no upload required. The homepage's result preview card mirrors the demo
state above the fold. Live provider pill on every page. Sample mode for
offline demo robustness. Pitch deck rendered to PDF. README and
submission copy aligned with the live app.

## Verified live (this branch)

|                                                |                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Tests                                          | **363 passing** + 1 skipped AMD live smoke (38 files)                          |
| Lint                                           | clean (`--max-warnings=0`)                                                     |
| Typecheck                                      | clean across 9 packages                                                        |
| Build                                          | registers `/demo/judge`, `/demo/debate`, `/api/debate`, `/api/healthcheck/llm` |
| Live AMD healthcheck                           | 128ms ping · 32K ctx · 16 tok/s · `engineMetrics` populated                    |
| Original Railway preview (main, OpenAI-backed) | unchanged — no regression                                                      |
| AMD-backed Railway preview (this PR)           | live at https://compliance-ai-amd-demo-production.up.railway.app               |
| Rate limit                                     | 5 debates / hour / IP on the public URL                                        |

Built for the [AMD × lablab.ai Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer),
May 2026. Tracks: AI Agents & Agentic Workflows · Build in Public ·
`#AMDDevHackathon`. Source: Apache-2.0.
