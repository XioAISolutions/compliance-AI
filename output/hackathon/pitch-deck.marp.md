---
marp: true
theme: default
class: invert
paginate: true
size: 16:9
---

<!-- _class: lead invert -->

# Three AI experts.

# One question. **Side by side.**

Built on **AMD Instinct MI300X** · Qwen 2.5 72B · vLLM
**AMD × lablab.ai Developer Hackathon · May 2026**

`compliance-ai-amd-demo-production.up.railway.app/demo/debate`

---

## The problem

Most AI tools give you **one answer.**

- Single perspective. Hidden bias. No visible disagreement.
- For high-stakes review (compliance · code · hard decisions), one answer is the **wrong shape.**
- Real review benefits from multiple stances **that disagree** — so a human can decide.

---

## What we built

A multi-agent cockpit where **three AI voices critique any input in parallel** — on a **single GPU** — then summarise where they agree and diverge.

- **4 universal use cases**
  - Compliance review · Code review · Hard decisions · Document critique
- **Optional Round 2** — voices defend, update, or concede their stance given the others
- **Citation-grade receipts** anchored to real NI 45-106 / OSC corpus

---

<!-- _class: lead invert -->

## Demo time

`/demo/debate` → pick **Decision making** → enable **Round 2** → click **Run debate**

→ Synthesis card lands first: verdict + agreed bullets + diverged bullets

→ Round 2 cards land with **DEFENDED** / **UPDATED** / **CONCEDED** stance pills

**~30 seconds wall-clock for the full panel on one MI300X.**

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

Three diagnostics make the GPU's work **legible to a non-expert viewer:**

1. **Context-window pill** — `32K ctx` sourced live from `/v1/models`
2. **Live tokens/sec pill** — emerald counter while streaming
3. **Round 2** — a second parallel batch of inferences on the same GPU

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
