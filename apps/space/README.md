---
title: XIO Compliance Brain · Triad Review on AMD MI300X
emoji: 🧠⚖️
colorFrom: blue
colorTo: red
sdk: gradio
sdk_version: 5.11.0
app_file: app.py
pinned: false
license: apache-2.0
short_description: Three AI reviewers on one AMD MI300X.
tags:
  - amd-mi300x
  - vllm
  - qwen
  - compliance
  - legal-ai
  - multi-agent
  - agentic-workflows
  - lablab-ai-amd-developer-hackathon
  - hackathon
models:
  - Qwen/Qwen2.5-72B-Instruct
---

# XIO Compliance Brain — Triad Review Engine

**Three AI reviewers — Regulatory Counsel · Risk Officer · Evidence Auditor — critique the same matter in parallel on a single AMD Instinct MI300X running Qwen 2.5 72B via vLLM.**

Synthesis turns three perspectives into one decision-grade verdict; optional Round 2 has voices defend, update, or concede their stance. Citations are verified. Output is hash-bound. Export is gated on approval. Audit rows record which inference engine served the matter — provider abstraction beats vendor lock-in.

## What's in this Space

- **90-second seeded demo** — pre-recorded Triad Review of an Ontario offering memorandum. Three reviewers, verified citations, surfaced disagreement, hash-bound approval. No upload, no GPU spend. Reads top to bottom.
- **Live debate** — sends your prompt to the live AMD MI300X-backed Railway endpoint. Three voices stream concurrently against one Qwen 2.5 72B endpoint on one 192 GB HBM3 GPU.

## Why it matters

Most legal-AI tools give one confident answer. That's dangerous in compliance — single perspective, hidden bias, no visible disagreement. XIO Compliance Brain shows three reviewer perspectives, verifies the evidence, exposes disagreement, and blocks export until the output is approval-ready.

## Why AMD MI300X

A single MI300X (192 GB HBM3) hosts Qwen 2.5 72B at full FP16 precision and serves a three-voice ensemble plus synthesis on a single card. The same workload on cloud APIs would need roughly 4× H100s — large GPU memory headroom is what makes parallel ensembles economical (~$0.04 self-hosted vs ≈$8 cloud per Triad Review).

## Built for

[AMD × lablab.ai Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer) · May 2026
Tracks: **AI Agents & Agentic Workflows · Build in Public**

## Source

- **Source branch**: [github.com/XioAISolutions/compliance-AI/tree/feat/amd-mi300x-vllm](https://github.com/XioAISolutions/compliance-AI/tree/feat/amd-mi300x-vllm)
- **Live (full app, AMD-backed)**: [compliance-ai-amd-demo-production.up.railway.app](https://compliance-ai-amd-demo-production.up.railway.app)
- **License**: Apache-2.0

`#AMDDevHackathon` `#lablabai`
