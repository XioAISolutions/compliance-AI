---
license: apache-2.0
language:
  - en
size_categories:
  - n<1K
task_categories:
  - text-generation
  - text-classification
pretty_name: XIO Compliance Brain — Triad Reviewer Prompts
tags:
  - compliance
  - legal-ai
  - multi-agent
  - prompts
  - amd-mi300x
  - vllm
  - qwen
  - lablab-ai-amd-developer-hackathon
  - hackathon
configs:
  - config_name: prompts
    data_files: prompts.jsonl
    default: true
  - config_name: examples
    data_files: examples.jsonl
---

# XIO Compliance Brain — Triad Reviewer Prompts

> Reusable system prompts for running a **multi-voice compliance debate** against the same matter — the heart of XIO Compliance Brain's "Triad Review Engine" pattern.

This dataset extracts the production prompts from the open-source [`compliance-AI` hackathon branch](https://github.com/XioAISolutions/compliance-AI/tree/feat/amd-mi300x-vllm) so others can replicate the Triad pattern (three reviewer voices + synthesis + optional Round 2) on any LLM that follows OpenAI-compatible chat APIs.

## What's in this dataset

### `prompts.jsonl` (4 rows)

| `role`  | `name`             | `purpose`                                                                                                                                               |
| ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`  | OM Reviewer        | Senior Canadian securities compliance reviewer (NI 45-106 / OSC Rule 45-501 / NI 31-103). Provides the citation-grade backbone every voice composes on. |
| `voice` | Regulatory Counsel | Skeptical lens — finds rule breaches, missing disclosures, jurisdiction issues. Downgrades aggressively when in doubt.                                  |
| `voice` | Risk Officer       | Permissive lens — scores business impact, severity, and operational exposure. Flags investor-reliance and suitability issues.                           |
| `voice` | Evidence Auditor   | Verification lens — refuses to sign off on findings without a verifiable authority. Marks every citation VERIFIED / NEEDS-CHECK / MISSING / STALE.      |

A row marked `role: "base"` is the foundation prompt; a `role: "voice"` row composes by appending its `suffix` to the `base` prompt at runtime. The pattern: same model, same matter, three system prompts → three perspectives in parallel.

### `examples.jsonl` (1 row)

A seeded Ontario offering memorandum (excerpt + reviewer instructions) plus the expected Triad output (6 findings, citation badges, 1 material disagreement). Useful for:

- **Eval** — replay the matter through your model + the prompts and compare findings to the expected set.
- **Prompt tuning** — see which voice catches which kind of finding.
- **Demos** — instant judge-grade input that doesn't require a real customer document.

## How to use it

```python
from datasets import load_dataset

prompts = load_dataset("<your-username>/xio-compliance-brain-triad-prompts", "prompts")
examples = load_dataset("<your-username>/xio-compliance-brain-triad-prompts", "examples")

base = next(p for p in prompts["train"] if p["role"] == "base")
voices = [p for p in prompts["train"] if p["role"] == "voice"]

example = examples["train"][0]
matter = example["input"]

# For each voice, run an LLM with system = base + suffix, user = matter
for voice in voices:
    system_prompt = base["system_prompt"] + "\n\n" + voice["suffix"]
    # ... call your LLM (Qwen 2.5 72B on AMD MI300X, OpenAI, Anthropic, Ollama, etc.)
```

## Provenance

- **Source branch**: [`github.com/XioAISolutions/compliance-AI/tree/feat/amd-mi300x-vllm`](https://github.com/XioAISolutions/compliance-AI/tree/feat/amd-mi300x-vllm)
- **Live (full app)**: [`compliance-ai-amd-demo-production.up.railway.app`](https://compliance-ai-amd-demo-production.up.railway.app)
- **Production model**: `Qwen/Qwen2.5-72B-Instruct` running on `vllm/vllm-openai-rocm` on a single AMD Instinct MI300X
- **License**: Apache-2.0 (matches source repo)

The `base` prompt is anchored to a 112-item Canadian securities regulation corpus (NI 45-106 + companion instruments, NI 45-102 resale rules, OSC Rule 45-501, NI 31-103 Part 13, NI 81-102 Part 15). The corpus itself is embedded in the source repo at `packages/cognition/src/authorities.ts` and is not duplicated here — drop it into your own retrieval layer.

## Why three voices

Most legal-AI tools give one confident answer. That's dangerous in compliance — single perspective, hidden bias, no visible disagreement. The Triad surfaces:

- **Critical gaps** that Counsel finds and Evidence verifies.
- **Promotional language risk** that Risk catches and Counsel might dismiss.
- **Citation deficiencies** that Evidence refuses to sign off on, even when Counsel and Risk would.

The synthesis pass (a fourth call) turns three blobs of dense markdown into one decision-grade verdict. Optional Round 2 has each voice defend, update, or concede their stance — a literal demonstration of multi-pass deliberation.

## Hackathon

Built for the [AMD × lablab.ai Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer), May 2026. Tracks: **AI Agents & Agentic Workflows · Build in Public**.

`#AMDDevHackathon` `#lablabai`
