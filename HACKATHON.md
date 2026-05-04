# AMD x lablab.ai Hackathon — compliance-brain on MI300X

> Working notes for the AMD Developer Hackathon (May 4–10, 2026). This file is a
> private working doc — not user-facing copy. The PR description on
> `feat/amd-mi300x-vllm` is the public version.

## Project at a glance

**Title (50 chars):** Citation-grade compliance review on AMD MI300X
**Summary (255 chars):** A securities-compliance brain that runs Qwen 2.5 72B on a single MI300X via vLLM. Three reviewer voices (skeptical / permissive / regulator) debate the same offering memorandum in parallel, citing live NI 45-106 authorities for every finding.
**Tracks:** AI Agents & Agentic Workflows • Build in Public

## Long description (≥100 words, lablab form)

compliance-brain is a securities-compliance review platform built for Canadian
private placements. For the AMD hackathon we wired the entire multi-agent
pipeline — classifier, router, drafter, judge, OM/KYC/marketing reviewers,
and citation verifier — onto a self-hosted Qwen 2.5 72B model running on a
single AMD Instinct MI300X via vLLM.

The headline capability is the **multi-voice debate panel**. The same
endpoint hosts three reviewer voices (skeptical, permissive, regulator) that
critique an offering memorandum in parallel. Because Qwen 2.5 72B fits
comfortably in MI300X's 192 GB HBM3, one GPU serves the whole panel — no
multi-host deployment required.

Every finding is anchored in retrieved NI 45-106 / OSC Rule 45-501
authorities; orphan `[cN]` markers trigger a citation-integrity retry pass
that resolves them against the known chunk set. Receipts (CRUMB handoffs)
record exactly which provider/model served the matter, so an audit trail
written today against AMD/Qwen is reproducible tomorrow against OpenAI or
Anthropic.

A single `LLM_PROVIDER=amd_vllm` env var moves the whole pipeline onto the
MI300X — no code paths are AMD-specific. The OpenAI / Ollama / Anthropic
paths remain fully supported, so the hosted preview keeps running while
local + demo traffic uses Qwen.

## "How does it scale" (lablab form)

A single MI300X (192 GB HBM3, 5.3 TB/s) hosts Qwen 2.5 72B at full FP16
precision and serves the three-voice debate panel concurrently —
demonstrating that real GPU memory headroom unlocks ensemble strategies that
cloud APIs price out of reach. To scale: add MI300X nodes behind a vLLM
gateway, route per-tenant via the existing `organizationId` scope, and
shard the cognition store along the same axis. The provider abstraction is
already env-flippable, so multi-tenant deployments can mix self-hosted Qwen
with cloud providers per regulatory jurisdiction.

## Tech stack tags (lablab form)

AMD Instinct MI300X • vLLM • Qwen 2.5 72B • ROCm 7.0 • Next.js 15 •
TypeScript • PostgreSQL • Drizzle ORM • Server-Sent Events • Vitest

## Live endpoints (public)

- App preview (OpenAI-backed): https://compliance-ai-preview-production.up.railway.app
- AMD live LLM (hackathon demo): http://129.212.190.73:8000/v1 _(droplet up only during demos)_
- Demo cockpit: `/demo`
- Multi-voice debate demo: `/demo/debate`
- Live LLM healthcheck: `/api/healthcheck/llm`
- CRUMB handoff with provider stamp: `/api/matters/<id>/handoff`

## Demo video — shot list (Loom or QuickTime, ~3 min target)

1. **0:00–0:15** Title card. "compliance-brain on AMD MI300X. One Qwen 2.5 72B model. Three reviewer voices. Citation-grade receipts."
2. **0:15–0:35** Terminal: `pnpm smoke:llm` against the AMD endpoint → "ready" in ~200ms. Voice-over: "First, the wiring. The CLI smoke pings the MI300X droplet directly — Qwen 2.5 72B, 211 millisecond round-trip."
3. **0:35–1:05** Browser: `/demo/debate` page. Status bar shows `amd_vllm/Qwen2.5-72B-Instruct`. Click "Run debate." All three voice cards light up in parallel. Voice-over: "One endpoint, three reviewer stances. The MI300X has 192 gigabytes of HBM3 — comfortable headroom for ensemble inference on a single GPU."
4. **1:05–1:35** Voice cards finish (~10–15s). Show the skeptic's stricter findings vs. the permissive reviewer's, then the regulator-voice citation pattern. Voice-over: "Three perspectives on the same paragraph, with cite-marker integrity validated against the retrieved NI 45-106 corpus."
5. **1:35–2:05** Switch to a real matter. Upload an OM PDF, click "Start review," let the drafter↔judge loop run on AMD. Voice-over: "The same endpoint serves the production review pipeline. Drafter, judge, citation-retry — all on Qwen."
6. **2:05–2:30** Click "Export handoff." Open the CRUMB file in a text editor; highlight the `provider: amd_vllm/Qwen/Qwen2.5-72B-Instruct` line in the YAML frontmatter. Voice-over: "The audit receipt records which inference engine served every step. Reproducible across providers."
7. **2:30–3:00** Cut to terminal showing the test count (322 → 334) and the green ROCm-native AMD smoke test passing. End card: "github.com/XioAISolutions/compliance-AI · #AMDDevHackathon"

## Pitch deck outline (10 slides max)

1. **The problem** — Canadian securities compliance reviews are slow, citation-poor, and lock firms into one cloud LLM vendor. A jurisdictional issue (data residency, regulator-acceptable engines) gates whether the AI can touch the work at all.
2. **The product** — compliance-brain. Multi-agent review (classifier, drafter, judge, citation verifier) with NI 45-106 / OSC Rule 45-501 corpus. CRUMB receipts. Used internally for OM, KYC, marketing reviews.
3. **What changed for AMD** — One env var (`LLM_PROVIDER=amd_vllm`) moves the whole pipeline onto a self-hosted MI300X serving Qwen 2.5 72B. No code paths are AMD-specific. (Show the diff.)
4. **The headline capability** — Multi-voice debate. Skeptical / permissive / regulator voices critique the same OM in parallel against ONE endpoint. (Show the screen recording.)
5. **Why MI300X matters** — 192 GB HBM3 means Qwen 2.5 72B in FP16 + the three-voice ensemble fit on a single GPU. The same workload would need 4× H100s on a cloud API at ~10× the cost. Show the receipt.
6. **Citation-grade receipts** — every finding cites a retrieved authority; orphan markers trigger an integrity-retry pass. CRUMB handoff stamps which provider served each step. Reproducible audit trail.
7. **Scaling story** — Per-tenant `organizationId` scope; mix self-hosted Qwen with cloud providers per jurisdiction. AMD nodes behind a vLLM gateway scale linearly.
8. **Tested + observable** — 334 unit tests passing, AMD live smoke skip-or-run, `/api/healthcheck/llm` for ops, CRUMB handoffs for audit.
9. **Build in public** — 3 #AMDDevHackathon posts, 1 PR diff, public Railway preview, public AMD demo endpoint during demo windows.
10. **The ask** — "We've shown one MI300X carries the panel. Funding lets us deploy a 4-node MI300X cluster for white-glove review of every Canadian private placement filing in 2026."

## Build-in-public posts (X / LinkedIn — 3 minimum, #AMDDevHackathon)

### Post 1 — "the diff"

> Wired our citation-grade compliance brain onto a single MI300X / Qwen 2.5 72B
> tonight. One env var flip — `LLM_PROVIDER=amd_vllm` — moved the whole
> multi-agent pipeline (classifier, drafter, judge, citation retry) onto the
> droplet. Existing OpenAI / Ollama paths untouched. PR diff in the thread 👇
> #AMDDevHackathon #lablabai
> [screenshot of the green test count + PR title]

### Post 2 — "the headline capability"

> The kicker isn't "ran inference on AMD." It's that 192 GB of HBM3 lets
> Qwen 2.5 72B host a _three-voice debate panel_ (skeptical / permissive /
> regulator) concurrently on **one** GPU. Same endpoint, different system
> prompts. ~10s for all three voices to land in parallel. #AMDDevHackathon
> [screen recording of /demo/debate]

### Post 3 — "the receipt"

> Every CRUMB handoff now stamps which inference engine served the matter.
> A review run today on AMD/Qwen looks identical in audit shape to one run
> tomorrow on OpenAI. Provider abstraction beats vendor lock. Citation
> integrity retry catches truncated fences. #AMDDevHackathon #lablabai
> [screenshot of CRUMB frontmatter showing `provider: amd_vllm/Qwen/Qwen2.5-72B-Instruct`]
