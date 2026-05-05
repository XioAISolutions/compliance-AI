---
marp: true
theme: default
class: invert
paginate: true
size: 16:9
---

<!-- _class: lead invert -->

# XIO Compliance Brain

# **Triad Review Engine** for audit-ready compliance work.

Counsel · Risk · Evidence — three AI reviewers on a single AMD GPU.
Built on **AMD Instinct MI300X** · Qwen 2.5 72B · vLLM
**AMD × lablab.ai Developer Hackathon · May 2026**

`compliance-ai-amd-demo-production.up.railway.app/demo/judge`

---

## The problem

Most AI tools give you **one answer.**

- Single perspective. Hidden bias. No visible disagreement.
- For high-stakes review (compliance · code · hard decisions), one answer is the **wrong shape.**
- Real review benefits from multiple stances **that disagree** — so a human can decide.

---

## What we built

A compliance workbench where **three AI reviewers critique a matter in parallel** — on a **single GPU** — verify citations, surface disagreement, and gate export on hash-bound approval.

- **Reviewer roles** — Regulatory Counsel · Risk Officer · Evidence Auditor
- **One answer vs Triad** — side-by-side proof that one chatbot answer is the wrong shape
- **Citation badges** — verified · needs-check · missing · stale · jurisdiction-mismatch
- **Optional Round 2** — voices defend, update, or concede after seeing the others
- **CRUMB receipts** anchored to NI 45-106 / OSC Rule 45-501 / NI 31-103 corpus
- **Inline audit chain** — 6 hash-linked rows, every one stamped with provider/model
- **Export gate** — DOCX / redline blocked until the output hash is approved

---

<!-- _class: lead invert -->

## Demo time

**`/demo/judge`** → seeded Ontario OM compliance review · no upload · reads top to bottom

- **One answer vs Triad** — side-by-side comparison: what a single-answer tool would say vs what the Triad found
- Compliance score · critical gaps · verified citations · needs-verification · reviewer disagreement · export status
- Where reviewers disagreed (Counsel vs. Risk vs. Evidence) → final action
- Approval required before export · output hash bound · DOCX / redline blocked
- **Inline audit chain** — 6 hash-linked rows, each stamped `amd_vllm/Qwen/Qwen2.5-72B-Instruct`

For a live model run: **`/demo/debate`** → pick a template → enable **Round 2** → run.
**~30 seconds wall-clock** for a full Triad panel on one MI300X.

---

## Why MI300X matters

|                                        | Cloud H100 cluster | **MI300X (single card)** |
| :------------------------------------- | :----------------- | :----------------------- |
| Memory                                 | 80 GB × N          | **192 GB HBM3**          |
| Qwen 2.5 72B in FP16                   | needs ≥2 GPUs      | **fits on 1**            |
| 3-voice ensemble + synthesis + round-2 | needs ~4× H100s    | **same single card**     |
| Marginal cost per debate               | ~$8 cloud API      | **~$0.04 self-hosted**   |

The headroom unlocks **ensemble strategies** cloud APIs price out of reach.

---

## Citation-grade receipts

Every compliance finding cites a retrieved authority.

CRUMB handoffs stamp **which provider served the matter:**

```yaml
---
type: task
description: Compliance-AI demo handoff
crumb-version: 1.2
provider: amd_vllm/Qwen/Qwen2.5-72B-Instruct
provider-base-url: http://<droplet>:8000/v1
---
```

A review run today on AMD/Qwen has the **same audit shape** as one tomorrow on OpenAI.
**Provider abstraction beats vendor lock-in.**

---

## Visible AMD power

Four diagnostics make the GPU's work **legible to a non-expert viewer:**

1. **Ensemble shape panel** — N voice-dots → vLLM endpoint → MI300X icon, all live; GPU glows when concurrent requests are running
2. **Context-window pill** — `32K ctx` sourced live from `/v1/models`
3. **Live tokens/sec pill** — emerald counter while streaming
4. **Round 2** — a second parallel batch of inferences on the same GPU
5. **KV-cache utilisation %** — GPU-cache pressure surfaced inline during streaming

Live healthcheck:

```
amd_vllm → Qwen/Qwen2.5-72B-Instruct · 32K ctx · 120ms · 17 tok/s · "ready"
```

---

## Architecture

```
                   ┌──────────────────────────────────────────┐
   POST            │   AMD Instinct MI300X (192 GB HBM3)      │
   /api/debate    │   vllm/vllm-openai-rocm:v0.17.1          │
   ─────────────►  │   Qwen/Qwen2.5-72B-Instruct (32K ctx)    │
                   │                                          │
   3 parallel      │   ╭────────╮  ╭────────╮  ╭──────────╮  │
   voices          │   │ Voice A│  │ Voice B│  │  Voice C │  │
   + synthesis     │   ╰────────╯  ╰────────╯  ╰──────────╯  │
   + (opt) round-2 │       └─────────┴────────────┘           │
                   │           ╭────────────╮                 │
                   │           │ Synthesizer│                 │
                   │           ╰────────────╯                 │
                   └──────────────────────────────────────────┘
   ◄── SSE: voice-started · voice-delta · voice-completed ·
            synthesis · followup-* · debate-done
```

---

## How it scales

- **Per-tenant `organizationId`** is already in the schema.
- **Provider abstraction is env-flippable** — multi-tenant can mix self-hosted Qwen with cloud per regulatory jurisdiction.
- **MI300X nodes behind a vLLM gateway scale linearly** — one node per ~50 concurrent debates.
- **Token-bucket rate limit** ships as a first-class primitive — cost ceiling is bounded.

---

## What ships in PR #56

- **17 commits** · **364 unit tests** + 1 AMD live smoke
- **Live preview on AMD:** [`compliance-ai-amd-demo-production.up.railway.app`](https://compliance-ai-amd-demo-production.up.railway.app)
- **Existing OpenAI Railway preview unchanged** — zero regressions
- **Open-source under Apache-2.0**
- **Independent code review by Codex CLI** (commit `c8f0c42`)

---

## What it took

- **~3 hours** from `LLM_PROVIDER=anthropic` → `amd_vllm` working in production
- **1 droplet at $1.99/hr** — total inference cost so far ≈ $15 of $100 credit
- Pair-built with **Claude Code** + **Codex CLI** via the `/with-codex` MCP protocol

---

<!-- _class: lead invert -->

## Try it

🌐 **Live:** `compliance-ai-amd-demo-production.up.railway.app/demo/debate`

📦 **Source:** `github.com/XioAISolutions/compliance-AI/pull/56`

🧪 **CLI smoke:** `pnpm smoke:llm`

📄 **60-second runbook:** `AMD_HACKATHON.md`

`#AMDDevHackathon`
