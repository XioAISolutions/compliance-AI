# Build-in-public posts — XIO Compliance Brain on AMD MI300X

> **Extra Challenge — Ship It + Build in Public**
>
> Each post must tag:
>
> - **On X (Twitter)**: `@lablabai` and `@AIatAMD`
> - **On LinkedIn**: `lablab.ai` and `AMD Developer`
>
> The challenge requires at least 2 technical updates with these tags. We
> have 3 posts ready below — Post #1 is the submission-day announcement
> (paste this link into the lablab Extra Challenge field), Posts #2 and
> #3 follow on day +1 and +2.
>
> Char counts for X are measured on the variant labelled "X (≤280)".
> Where the long-form version exceeds 280, a tight ≤280 variant is
> provided alongside for free-tier X accounts; LinkedIn has no hard
> limit and uses the long-form copy.

---

## Post #1 — "Triad Review on AMD" (submission-day announcement)

### X (≤280 chars · standalone)

```
XIO Compliance Brain on AMD MI300X — Qwen 2.5 72B via vLLM. Three reviewers (Counsel · Risk · Evidence) debate one matter on ONE GPU.

192 GB HBM3 fits the ensemble. Cloud needs ~4× H100s.

compliance-ai-amd-demo-production.up.railway.app/demo/judge

@lablabai @AIatAMD #AMDDevHackathon
```

_(254 chars after X auto-shortens the URL to 23 — verify in X's composer before posting.)_

### X (long-form / Premium / thread anchor)

```
Shipped XIO Compliance Brain on a single AMD MI300X tonight. One env flip — LLM_PROVIDER=amd_vllm — moved the whole pipeline onto Qwen 2.5 72B running in vLLM on one GPU.

Three AI reviewers — Counsel · Risk · Evidence — critique a real offering memorandum in parallel. Synthesis surfaces where they agree, where they diverge, and the final action. Citations carry verification badges. Output is bound to a SHA-256 hash; export is blocked until approved.

Live (90-second seeded judge demo, no upload):
https://compliance-ai-amd-demo-production.up.railway.app/demo/judge

192 GB of HBM3 makes the whole ensemble fit on one card. Cloud APIs would need ~4× H100s for the same trick.

@lablabai @AIatAMD #AMDDevHackathon #lablabai
```

### LinkedIn

```
Shipped XIO Compliance Brain on a single AMD Instinct MI300X tonight. One environment-variable flip — LLM_PROVIDER=amd_vllm — moved the whole multi-agent pipeline onto Qwen 2.5 72B running in vLLM on one GPU.

Three AI reviewers — Counsel · Risk · Evidence — critique a real offering memorandum in parallel. A synthesis pass surfaces where they agree, where they diverge, and the final action. Every citation carries a verification badge (verified / needs-check / missing / stale / jurisdiction-mismatch). Output is bound to a SHA-256 hash; export is blocked until a human approver signs the hash.

Live (90-second seeded judge demo, no upload required):
https://compliance-ai-amd-demo-production.up.railway.app/demo/judge

192 GB of HBM3 is what makes the whole ensemble fit on one card. Cloud APIs would need roughly 4× H100s for the same trick — large GPU memory headroom is what makes parallel ensembles economically possible (~$0.04 self-hosted vs ≈$8 cloud per Triad Review).

Built for the AMD × lablab.ai Developer Hackathon, May 2026.
Tracks: AI Agents & Agentic Workflows · Build in Public.

cc lablab.ai · AMD Developer
#AMDDevHackathon #lablabai
```

**Image to attach:** [`output/hackathon/video/judge-comparison.png`](./video/judge-comparison.png) — `/demo/judge` showing the **One answer vs Triad** comparison panel at the top: left column is what a generic legal-AI chatbot would say (confident, uncited paragraph), right column is what the Triad found (3 critical gaps · 5 verified citations · 1 material disagreement · export blocked). Tagline below: "Both took the same input. One is dangerous in compliance."

---

## Post #2 — "Why three reviewers, not one" (day +1)

### X (≤280 chars · standalone)

```
Most legal-AI demos give one confident answer. That's dangerous in compliance.

XIO's Triad Review runs three reviewer perspectives — Counsel · Risk · Evidence — in parallel on a single AMD MI300X. Synthesis. Optional Round 2. ~30s wall.

@lablabai @AIatAMD #AMDDevHackathon
```

_(269 chars — verify before posting.)_

### X (long-form / Premium)

```
Most legal-AI demos give one confident answer. That's dangerous in compliance.

XIO's Triad Review runs THREE reviewer perspectives concurrently against the same matter, on a single AMD MI300X. Counsel finds rule breaches. Risk scores severity. Evidence verifies citations and refuses to sign off on unsupported claims.

Then a 4th call synthesises agree/diverge/verdict. Optional Round 2 has the voices defend, update, or concede after seeing the others.

Whole panel runs in ~25-35s. 192 GB of HBM3 is what makes the ensemble economically possible.

@lablabai @AIatAMD #AMDDevHackathon #lablabai
```

### LinkedIn

```
Most legal-AI demos give you one confident answer. That's dangerous in compliance — single perspective, hidden bias, no visible disagreement.

So XIO's Triad Review runs three reviewer perspectives concurrently against the same matter, on a single AMD Instinct MI300X:

• Counsel finds rule breaches and missing disclosures
• Risk scores investor exposure and operational severity
• Evidence verifies every citation and refuses to sign off on unsupported claims

Then a fourth synthesis call lands a single decision-grade verdict — agree / diverge / final action.

Optional Round 2: voices respond to the synthesis and to each other. Each defends, updates, or concedes its stance. A literal demonstration of multi-pass deliberation, on the same GPU, in another ~10 seconds.

Whole panel runs in ~25-35 seconds end-to-end. 192 GB of HBM3 is what makes parallel ensembles economically possible — cloud APIs would need roughly 4× H100s for the same workload.

cc lablab.ai · AMD Developer
#AMDDevHackathon #lablabai
```

**Image / video to attach:** screen recording (≤30s) of `/demo/debate` running the compliance template — the **ensemble shape panel** at the top animates as voices stream (3 dots blinking blue → green, MI300X icon glows emerald with live KV-cache %), voice cards fill token by token, synthesis appears, then Round-2 stance pills land (DEFENDED / UPDATED / CONCEDED). Static stills available at [`output/hackathon/video/debate-running.png`](./video/debate-running.png) and [`output/hackathon/video/debate-final-round2.png`](./video/debate-final-round2.png) if a clip isn't ready in time. The full demo cut is at [`output/hackathon/demo-video.mp4`](./demo-video.mp4) (2:16, 1920×1080).

---

## Post #3 — "The receipt" (day +2)

### X (≤280 chars · standalone)

```
Every XIO handoff stamps which engine served the matter. A review on AMD/Qwen today has the same audit shape as one on OpenAI tomorrow.

Provider abstraction beats vendor lock. Citation integrity. Hash-bound approval. Audit-ready output.

@lablabai @AIatAMD #AMDDevHackathon
```

_(273 chars — verify before posting.)_

### X (long-form / Premium)

```
Every CRUMB handoff stamps which inference engine served the matter. Every audit row records actor, action, input/output hash, prev-row hash (chain-linked, tamper-evident), authorities cited, and which provider/model served it.

A review run today on AMD/Qwen looks identical in audit shape to one run tomorrow on OpenAI. Provider abstraction beats vendor lock-in.

Citation badges are real: verified / needs-check / missing / stale / jurisdiction-mismatch. Output hash is real. Export is gated on the approver matching that exact hash.

The result is audit-ready compliance work product, not just an AI answer.

@lablabai @AIatAMD #AMDDevHackathon #lablabai
```

### LinkedIn

```
Every CRUMB handoff stamps which inference engine served the matter. Every audit row records actor, action, input/output hash, prev-row hash (chain-linked, tamper-evident), the authorities cited, and the provider/model that produced the row.

A review run today on AMD/Qwen looks identical in audit shape to one run tomorrow on OpenAI. Provider abstraction beats vendor lock-in.

The citation badges are real: verified / needs-check / missing / stale / jurisdiction-mismatch. The output hash is real — bound to the exact bytes the reviewers signed off on. Export of DOCX, redline PDF, and the read-only CRUMB pack is gated on a human approver matching that exact hash.

The result is audit-ready compliance work product. Not just an AI answer.

Source: https://github.com/XioAISolutions/compliance-AI/tree/feat/amd-mi300x-vllm
Live (seeded judge demo): https://compliance-ai-amd-demo-production.up.railway.app/demo/judge

cc lablab.ai · AMD Developer
#AMDDevHackathon #lablabai
```

**Image to attach:** [`output/hackathon/video/judge-audit-chain.png`](./video/judge-audit-chain.png) — `/demo/judge` with the **Show audit chain** disclosure expanded: 6 hash-linked rows visible, each one showing actor · action · output hash · prev-row hash · authorities cited · `servedBy: amd_vllm/Qwen2.5-72B`. The chain is what regulators receive in a CRUMB handoff pack, surfaced inline so judges don't need to download anything to see the audit shape.

---

## Posting cadence + Extra Challenge checklist

- [ ] **Post #1** — submission day, immediately after lablab form submitted.
      Attach `output/hackathon/video/judge-comparison.png`.
      Paste post URL into the lablab Extra Challenge field.
- [ ] **Post #2** — day +1. Attach the screen recording or the still
      `output/hackathon/video/debate-running.png`.
- [ ] **Post #3** — day +2. Attach
      `output/hackathon/video/judge-audit-chain.png`.

Each post on each platform must tag:

| Platform    | Required mentions                                                       | Hashtags                       |
| ----------- | ----------------------------------------------------------------------- | ------------------------------ |
| X (Twitter) | `@lablabai` `@AIatAMD`                                                  | `#AMDDevHackathon` `#lablabai` |
| LinkedIn    | `lablab.ai` (page mention via @) · `AMD Developer` (page mention via @) | `#AMDDevHackathon` `#lablabai` |

> 💡 LinkedIn @-mentions: type `@lablab` or `@AMD Developer` in the
> composer and pick the suggested page from the dropdown — the plain
> text shown above will be auto-converted to a real page tag. The
> "cc lablab.ai · AMD Developer" line in the LinkedIn copy above is
> a placeholder for that.

> 💡 X char counts above measure the literal text. X auto-shortens any
> URL to 23 chars on display, but the count above already accounts for
> that. Use https://twitterlength.com or X's own composer to verify
> before posting if you want to be paranoid.

Three technical updates with `#AMDDevHackathon` plus the `@lablabai` /
`@AIatAMD` mentions qualifies for **both** the standard Build in Public
track AND the Extra Challenge bonus.
