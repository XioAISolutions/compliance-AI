# compliance-brain on AMD MI300X — Pitch Deck

Markdown source for the hackathon pitch deck. Import into Google Slides
via [Markdown to Slides](https://gitprint.com/) extensions, or render with
`pnpm dlx marp-cli` (Marpit syntax).

---

marp: true
theme: default
class: invert
paginate: true

---

<!-- _class: lead -->

# Three AI experts.

# One question. **Side by side.**

Built on AMD Instinct MI300X · Qwen 2.5 72B · vLLM
**AMD × lablab.ai Developer Hackathon · May 2026**

`https://compliance-ai-amd-demo-production.up.railway.app/demo/debate`

---

## The problem

Most AI tools give you **one answer**.

- Single perspective, hidden bias, no visible disagreement.
- For high-stakes review (compliance, security, hard decisions), one answer
  is the **wrong shape**.
- Real review benefits from multiple stances _that disagree_ — so a human
  can decide.

---

## What we built

A multi-agent cockpit where **three AI voices critique any input in
parallel**, on a single GPU, then summarise where they agree and diverge.

- 4 universal use cases: **compliance review · code review · hard
  decision · document critique**
- **Optional Round 2** — voices defend, update, or concede their stance
  given the others
- **Citation-grade receipts** for compliance reviews (NI 45-106 corpus)

---

<!-- _class: lead -->

## Demo time

`/demo/debate` → pick "Decision making" → enable Round 2 → click Run
debate → synthesis card appears with verdict + agree/diverge bullets →
Round 2 cards land with DEFENDED / UPDATED / CONCEDED stance pills.

**~30 seconds wall-clock for the full panel on one MI300X.**

---

## Why MI300X matters

|                                  | H100 cluster     | **MI300X (single)**  |
| -------------------------------- | ---------------- | -------------------- |
| Memory                           | 80 GB × N        | **192 GB HBM3**      |
| Qwen 2.5 72B in FP16             | needs ~2 GPUs    | **fits on 1**        |
| Three-voice ensemble + synthesis | needs 4× H100s   | **same single GPU**  |
| Inference cost (this demo)       | ~$8/run on cloud | **$0** (self-hosted) |

The headroom unlocks ensemble strategies cloud APIs price out of reach.

---

## Citation-grade receipts

Every compliance finding cites a retrieved authority.

CRUMB handoffs stamp which provider served the matter:

```yaml
---
type: task
description: Compliance-AI demo handoff
crumb-version: 1.2
provider: amd_vllm/Qwen/Qwen2.5-72B-Instruct
provider-base-url: http://<droplet>:8000/v1
---
```

A review run today on AMD/Qwen has the **same audit shape** as one run
tomorrow on OpenAI. Provider abstraction beats vendor lock-in.

---

## Visible AMD power

Three diagnostics make the GPU's work _legible_:

1. **Context-window pill** — `32K ctx` sourced live from `/v1/models`
2. **Live tokens/sec pill** — emerald counter while streaming. The viewer
   sees throughput, not a static benchmark.
3. **Round 2** — a second parallel batch of inferences on the same GPU.
   Real second-order compute, visible to the viewer.

---

## Architecture

```
                            ┌──────────────────────────────────────────┐
                            │   AMD Instinct MI300X (192 GB HBM3)      │
                            │   vllm/vllm-openai-rocm:v0.17.1          │
   POST /api/debate         │   Qwen/Qwen2.5-72B-Instruct (32K ctx)    │
   ──────────────────────►  │                                          │
   3 voices in parallel     │   ╭────────╮  ╭────────╮  ╭──────────╮  │
   + 1 synthesis            │   │ Voice A│  │ Voice B│  │  Voice C │  │
   + (optional) round-2     │   ╰────────╯  ╰────────╯  ╰──────────╯  │
                            │       └─────────┴────────────┘           │
                            │           ╭────────────╮                 │
                            │           │ Synthesizer│                 │
                            │           ╰────────────╯                 │
                            └──────────────────────────────────────────┘
   ◄────── SSE: voice-started / voice-delta / voice-completed
            / synthesis / followup-* / debate-done
```

---

## How it scales

- **Per-tenant `organizationId` scope** is already in the schema.
- **Provider abstraction is env-flippable** — multi-tenant deployments
  can mix self-hosted Qwen with cloud providers per regulatory
  jurisdiction.
- **MI300X nodes behind a vLLM gateway scale linearly** — one node per
  ~50 concurrent debates at the current voice/token budget.
- **Token-bucket rate limit** (5/hour/IP default) ships as a first-class
  primitive so the cost ceiling is bounded.

---

## What ships in PR #56

- 16 commits, 364 unit tests passing + 1 AMD live smoke
- Live preview on AMD: `https://compliance-ai-amd-demo-production.up.railway.app`
- Existing OpenAI Railway preview unchanged — no regressions
- Open-source under Apache-2.0
- Independent code review by Codex CLI (commit `c8f0c42`)

---

## What it took

- ~3 hours from `LLM_PROVIDER=anthropic` → `amd_vllm` working in production
- 1 droplet ($1.99/hr) — total inference cost so far: ~$15 of the $100 credit
- Solo-built with [Claude Code](https://claude.com/claude-code) +
  [Codex CLI](https://github.com/openai/codex), pair-programmed via the
  `/with-codex` MCP protocol

---

<!-- _class: lead -->

## Try it

🌐 Live: `compliance-ai-amd-demo-production.up.railway.app/demo/debate`

📦 Source: `github.com/XioAISolutions/compliance-AI/pull/56`

🧪 CLI smoke: `pnpm smoke:llm`

📄 60-second runbook: `AMD_HACKATHON.md`

`#AMDDevHackathon`
