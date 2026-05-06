"""
XIO Compliance Brain — Hugging Face Space (Gradio).

Companion to the full Next.js app at github.com/XioAISolutions/compliance-AI.
Two tabs:

1. Seeded demo — renders the same /demo/judge content (One-answer-vs-Triad
   comparison, findings, audit chain) entirely from static data. No GPU
   spend, no Railway dependency, always works.

2. Live debate — POSTs to the production /api/debate SSE endpoint
   (AMD MI300X / Qwen 2.5 72B / vLLM) and streams the three voices as
   they arrive. Falls back gracefully when the AMD droplet is offline.

Built for the AMD × lablab.ai Developer Hackathon (May 2026).
Tracks: AI Agents & Agentic Workflows · Build in Public.
License: Apache-2.0.
"""

from __future__ import annotations

import json
import time
from typing import Iterator

import gradio as gr
import httpx

# ----------------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------------

LIVE_BASE = "https://compliance-ai-amd-demo-production.up.railway.app"
DEBATE_URL = f"{LIVE_BASE}/api/debate"
HEALTH_URL = f"{LIVE_BASE}/api/healthcheck/llm"

# ----------------------------------------------------------------------------
# Seeded data — mirrors apps/web/src/lib/triad-seed.ts
# Kept as plain markdown rather than full data structures because Gradio
# renders markdown natively and we don't need the React-side layout flex.
# ----------------------------------------------------------------------------

SEEDED_MATTER_TITLE = "Ontario OM Compliance Review — North Capital Series A"
SEEDED_MATTER_META = "NI 45-106 · Ontario · Exempt Market Dealer · Form 45-106F2"
SEEDED_EXCERPT = (
    "The issuer offers Class A units to accredited investors only. Past performance has "
    "consistently exceeded benchmarks. Subscription proceeds will be applied to general "
    "working capital. Risk factors are listed in Schedule B."
)

GENERIC_SINGLE_ANSWER = (
    "This Ontario offering memorandum appears to comply with NI 45-106 in its general "
    "structure. The disclosure of accredited-investor offering, past performance, use of "
    "proceeds, and risk factors are all present. No material deficiencies are evident "
    "from the excerpt provided. Standard private-placement language is used throughout."
)


def render_seeded_markdown() -> str:
    """Render the /demo/judge content as a single markdown blob."""
    return f"""
## Matter

**{SEEDED_MATTER_TITLE}**
_{SEEDED_MATTER_META}_

> _Excerpt under review:_ "{SEEDED_EXCERPT}"

| Compliance score | Critical gaps | Verified citations | Needs verification | Reviewer disagreement | Export |
|---:|---:|---:|---:|---:|:---:|
| 62% | **3** | 5 | 2 | 1 material | 🚫 BLOCKED · pending approval |

---

## 🤖 One answer vs Triad — the originality story made visible

**What a generic legal-AI chatbot would return:**

> "{GENERIC_SINGLE_ANSWER}"

**What XIO Triad found:**

- 🔴 **3 critical gaps** — past-performance representation lacks substantiation; use of proceeds not itemised; rights-of-action disclosure not located in the excerpt.
- ✅ **5 verified citations** — anchored to NI 45-106, Form 45-106F2 Item 2.4, OSC SN 33-316, NI 45-106 §2.9, BC Instrument 45-533.
- 🟡 **1 material disagreement** — Counsel says "too promotional"; Risk says "high investor reliance"; Evidence says "no verifiable benchmark methodology."
- 🚫 **Export blocked** — output bound to SHA-256 hash; DOCX / redline gated until approval.

_Both columns took the same input. One is dangerous in compliance._

---

## The Triad — three reviewer perspectives

### 🔵 Regulatory Counsel
_Rule breaches · missing disclosures · jurisdiction issues_
Finds rule breaches, missing disclosures, and jurisdiction issues against the applicable corpus (NI 45-106, OSC Rule 45-501, NI 31-103). Raised **2 findings**.

### 🟠 Risk Officer
_Severity · investor exposure · operational risk_
Scores business impact, severity, and operational exposure. Flags issues that would draw a regulator's eye even when technically defensible. Raised **2 findings**.

### 🟢 Evidence Auditor
_Citation verification · stale authority · source gaps_
Checks citations, stale authorities, unsupported claims, and source gaps. **Refuses to sign off on findings without a verifiable authority.** Raised **2 findings**.

---

## Findings (6 total · 4 recommended fixes)

### 🔴 [CRITICAL] Past-performance representation lacks substantiation
Raised by **Counsel**.
The OM states past performance has consistently exceeded benchmarks without identifying the benchmark, the period, calculation methodology, or net-of-fees presentation. Non-substantiated performance representations are the single most common deficiency on OSC 45-106 reviews.

**Recommended fix:** Replace the performance line with a benchmarked, period-bounded, net-of-fees calculation, and add a verifiable authority for the methodology used.

📎 _Citation:_ Companion Policy 45-106CP §2.9 — "An offering memorandum should not contain promotional language and should be balanced in its presentation of risks and benefits." `[verified]`

### 🔴 [CRITICAL] Use of proceeds is not itemised
Raised by **Counsel**.
Form 45-106F2 Item 2.4 requires an itemised allocation of subscription proceeds. The phrase "general working capital" is not specific enough to satisfy the form requirement and is a routine first-pass deficiency.

**Recommended fix:** Replace "general working capital" with a top-three breakdown (e.g. acquisition reserves, operating cash, regulatory capital) and total-percent disclosure.

📎 _Citation:_ Form 45-106F2 Item 2.4 — "Provide a detailed breakdown of how the issuer will use the available funds." `[verified]`

### 🟠 [HIGH] Statutory rights of action — disclosure not located
Raised by **Evidence**.
NI 45-106 §2.9 grants statutory rights of action for misrepresentation in an OM. The excerpt does not contain the rights-of-action disclosure language and the audit cannot confirm it appears elsewhere.

**Recommended fix:** Confirm the OM's Schedule B (or equivalent) contains the prescribed rights-of-action language and resurface the citation in the audit.

📎 _Citation:_ NI 45-106 §2.9 — "Securities legislation grants purchasers rights of action for damages or rescission against the issuer or selling security holder." `[needs-check]`

### 🟠 [HIGH] Marketing-tone language elevates investor reliance
Raised by **Risk**.
Phrasing like "consistently exceeded benchmarks" invites investor reliance even if technically defensible. NI 81-102 §15 prohibitions and OSC Staff Notice 33-316 expectations apply by analogy.

**Recommended fix:** Strip promotional adjectives. Replace with the benchmarked calculation and a balanced statement of past performance not predicting future returns.

📎 _Citation:_ OSC Staff Notice 33-316 — "Registrants are reminded that promotional language increases the likelihood of investor reliance and the corresponding suitability obligations." `[verified]`

### 🟡 [MEDIUM] Jurisdiction check — confirm Ontario-only offering
Raised by **Evidence**.
Excerpt does not specify the jurisdictions of distribution. If the OM is also being used outside Ontario, additional disclosures may be required.

**Recommended fix:** Add an explicit "Jurisdictions of distribution" section listing every province/territory the OM covers, and align supplementary disclosures.

📎 _Citation:_ BC Instrument 45-533 — "An issuer relying on the OM exemption in British Columbia must include the BC-specific risk acknowledgement form." `[jurisdiction-mismatch]` _(authority is BC-specific; matter is Ontario-only — surface as a check, not a confirmed gap)_

### 🟡 [MEDIUM] Risk-factor schedule referenced but not inspected
Raised by **Risk**.
The OM defers all risk factors to Schedule B. Schedule B itself has not been provided to the reviewer. Cannot complete the risk-factor adequacy assessment.

**Recommended fix:** Provide Schedule B in full so risk factors can be assessed for completeness, ordering by materiality, and consistency with the body of the OM.

⚠️ _No citations attached — Evidence Auditor refuses to sign off until verifiable authority is supplied._

---

## Where reviewers disagreed

### Past-performance language

- **Counsel:** Disclosure is too promotional without adequate limitation; the rule requires a balanced presentation.
- **Risk:** High risk because the language directly invites investor reliance and elevates suitability exposure.
- **Evidence:** Cannot stand without verifiable benchmark identification, period, and methodology citation — the source layer is empty.

**Final action:** Rewrite the performance claim with a benchmarked, period-bounded, net-of-fees calculation. Attach a verified authority before resubmission.

---

## 🚫 Approval gate — export blocked

| Field | Value |
|---|---|
| Output hash | `sha256:9f1e3a8c5b2d7f4e0c8a6b3d2e1f7a4c5b9d8e2f1a3c4b5d6e7f8a9b0c1d2e3f` |
| Reviewer status | ITERATE |
| Approval state | PENDING |
| Export state | BLOCKED-PENDING-APPROVAL |
| DOCX / redline PDF | 🚫 blocked until human approver signs the output hash |
| CRUMB handoff pack | ✅ available — read-only audit trail, safe to share |

In the [full app at compliance-ai-amd-demo-production.up.railway.app/demo/judge](https://compliance-ai-amd-demo-production.up.railway.app/demo/judge), the DOCX, redline-PDF, and CRUMB pack buttons all download the seeded artifact in their respective formats so you can see the export shape.

---

## 🔗 Audit chain — 6 hash-linked rows

| # | Actor · Action | Output hash | Authorities | Served by |
|---:|---|---|---|---|
| 1 | ingest-pipeline · ingest | `sha256:0a1b2c3d…` | — | `amd_vllm/Qwen/Qwen2.5-72B-Instruct` |
| 2 | counsel-bot · review | `sha256:4f5e6d7c…` | 2 cited | `amd_vllm/Qwen/Qwen2.5-72B-Instruct` |
| 3 | risk-bot · review | `sha256:12345678…` | 1 cited | `amd_vllm/Qwen/Qwen2.5-72B-Instruct` |
| 4 | evidence-bot · review | `sha256:abcdef12…` | 2 cited | `amd_vllm/Qwen/Qwen2.5-72B-Instruct` |
| 5 | synthesis-editor · synthesis (verdict: iterate) | `sha256:9f1e3a8c…` | 5 cited | `amd_vllm/Qwen/Qwen2.5-72B-Instruct` |
| 6 | approval-bot · approval-request (verdict: iterate) | `sha256:9f1e3a8c…` | — | `amd_vllm/Qwen/Qwen2.5-72B-Instruct` |

Notice every row's `servedBy` stamp. A review run tomorrow on OpenAI would produce the **same audit shape** with a different stamp — that's what "provider abstraction beats vendor lock-in" means in practice.

---

## Engine receipt

- **Provider:** `amd_vllm/Qwen/Qwen2.5-72B-Instruct`
- **Workflow:** 3 reviewer passes (parallel) → editor synthesis → optional Round 2 reflection
- **Hardware target:** AMD Instinct MI300X (192 GB HBM3)
- **Recorded run:** 24.4s wall-clock

_Demo seed. The Ontario OM excerpt and findings are illustrative — not a real customer engagement._
"""


# ----------------------------------------------------------------------------
# Live debate — streams /api/debate SSE
# ----------------------------------------------------------------------------

DEFAULT_PROMPT = (
    "Review the following offering memorandum excerpt for compliance with Ontario "
    "securities law (NI 45-106): 'The issuer offers Class A units to accredited "
    "investors only. Past performance has consistently exceeded benchmarks. "
    "Subscription proceeds will be applied to general working capital. Risk "
    "factors are listed in Schedule B.'"
)

TEMPLATE_VOICES = {
    "compliance": [
        {
            "name": "Skeptical Counsel",
            "systemPromptOverride": (
                "You are a skeptical Canadian securities lawyer reviewing an offering "
                "memorandum. Find rule breaches and missing disclosures. Be specific."
            ),
        },
        {
            "name": "Permissive Risk",
            "systemPromptOverride": (
                "You are a permissive risk officer. Score business impact and severity "
                "but consider what's defensible. Be specific."
            ),
        },
        {
            "name": "Evidence Auditor",
            "systemPromptOverride": (
                "You are a strict evidence auditor. Verify citations and refuse to sign "
                "off on unsupported claims. Be specific."
            ),
        },
    ],
}


def stream_live_debate(prompt: str, enable_round2: bool) -> Iterator[str]:
    """Stream the live debate from Railway /api/debate SSE.

    Yields accumulated markdown so Gradio renders progressively. Falls back
    to a clear error message if the Railway endpoint is unreachable or the
    AMD droplet is offline.
    """
    if not prompt or not prompt.strip():
        yield "_Enter a prompt above and click Run debate._"
        return

    voices = TEMPLATE_VOICES["compliance"]
    voice_states = [
        {"name": v["name"], "status": "pending", "prose": ""} for v in voices
    ]
    synthesis: dict[str, object] | None = None
    started_at = time.time()
    md = ["**Connecting to AMD MI300X via Railway…**\n"]

    try:
        body = {
            "userMessage": prompt,
            "voices": voices,
            "retrieveAuthorities": True,
            "followup": enable_round2,
        }
        with httpx.stream(
            "POST",
            DEBATE_URL,
            json=body,
            timeout=httpx.Timeout(connect=10.0, read=120.0, write=10.0, pool=10.0),
        ) as r:
            if r.status_code != 200:
                yield (
                    f"❌ **Live debate unavailable** — Railway returned HTTP "
                    f"{r.status_code}. The seeded demo above always works.\n\n"
                    f"_If the AMD droplet is intentionally stopped between demos to "
                    f"stretch hackathon credit, this is expected. Try the seeded "
                    f"demo tab._"
                )
                return

            buffer = ""
            for chunk in r.iter_text():
                buffer += chunk
                while "\n\n" in buffer:
                    frame, buffer = buffer.split("\n\n", 1)
                    for line in frame.split("\n"):
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if not data:
                            continue
                        try:
                            event = json.loads(data)
                        except json.JSONDecodeError:
                            continue

                        t = event.get("type")
                        if t == "voice-started":
                            i = int(event.get("index", -1))
                            if 0 <= i < len(voice_states):
                                voice_states[i]["status"] = "running"
                        elif t == "voice-delta":
                            i = int(event.get("index", -1))
                            delta = str(event.get("delta", ""))
                            if 0 <= i < len(voice_states):
                                voice_states[i]["prose"] += delta
                        elif t == "voice-completed":
                            i = int(event.get("index", -1))
                            status = event.get("status", "ok")
                            if 0 <= i < len(voice_states):
                                voice_states[i]["status"] = status
                                voice_states[i]["prose"] = str(
                                    event.get("prose", voice_states[i]["prose"])
                                )
                        elif t == "synthesis":
                            synthesis = {
                                "agreed": event.get("agreed", []) or [],
                                "disagreed": event.get("disagreed", []) or [],
                                "verdict": str(event.get("verdict", "")),
                            }
                        elif t == "debate-done":
                            pass

                        # Re-render the markdown view with current state.
                        elapsed = time.time() - started_at
                        md = [
                            f"**Live debate — AMD MI300X · {elapsed:.1f}s elapsed**\n"
                        ]
                        if synthesis:
                            md.append("\n## 🧠 Synthesis · the takeaway\n")
                            if synthesis.get("verdict"):
                                md.append(
                                    f"**{synthesis.get('verdict')}**\n"
                                )
                            agreed = synthesis.get("agreed") or []
                            if agreed:
                                md.append("\n### ✅ All voices agreed\n")
                                for a in agreed:
                                    md.append(f"- {a}")
                            disagreed = synthesis.get("disagreed") or []
                            if disagreed:
                                md.append("\n### ⚠️ Voices diverged\n")
                                for d in disagreed:
                                    md.append(f"- {d}")
                        for vs in voice_states:
                            status_emoji = {
                                "pending": "⚪",
                                "running": "🔵",
                                "ok": "🟢",
                                "error": "🔴",
                                "timeout": "🟡",
                            }.get(str(vs["status"]), "⚪")
                            md.append(f"\n## {status_emoji} {vs['name']}\n")
                            if vs["prose"]:
                                md.append(str(vs["prose"]))
                            elif vs["status"] == "running":
                                md.append("_streaming…_")
                            elif vs["status"] == "pending":
                                md.append("_awaiting…_")
                        yield "\n".join(md)
    except httpx.ConnectError:
        yield (
            "❌ **Live debate unreachable** — couldn't connect to the Railway endpoint. "
            "The seeded demo on the other tab always works.\n\n"
            f"_Endpoint: `{DEBATE_URL}`_"
        )
    except httpx.HTTPError as e:
        yield (
            f"❌ **Live debate failed** — `{type(e).__name__}: {e}`. The seeded demo "
            f"on the other tab always works."
        )

    # Final render
    elapsed = time.time() - started_at
    md_final = ["\n---\n"]
    md_final.append(f"_Wall-clock: {elapsed:.1f}s on a single AMD MI300X._")
    yield "\n".join(md + md_final)


# ----------------------------------------------------------------------------
# Health pill
# ----------------------------------------------------------------------------


def health_check() -> str:
    """Probe the live AMD endpoint and render a status pill."""
    try:
        r = httpx.get(HEALTH_URL, timeout=5.0)
        if r.status_code != 200:
            return (
                f"🟡 **AMD endpoint** returned HTTP {r.status_code} — "
                f"seeded demo always works."
            )
        d = r.json()
        if not d.get("ok"):
            return (
                "🟡 **AMD droplet warming** — we cycle the GPU between demos to "
                "stretch hackathon credit. Use the seeded demo for now; live "
                "debate will work once the droplet is back up."
            )
        ctx = d.get("modelInfo", {}).get("maxContextTokens")
        ctx_label = (
            f"{round(ctx / 1024)}K ctx" if ctx and ctx >= 1024 else f"{ctx} ctx"
        )
        return (
            f"✅ **AMD endpoint live** · `{d.get('provider')}` · "
            f"`{d.get('model')}` · {ctx_label} · {d.get('latencyMs')}ms · "
            f"{d.get('tokensPerSec', '?')} tok/s"
        )
    except Exception as e:  # pylint: disable=broad-except
        return (
            f"🟡 **Healthcheck error** — `{type(e).__name__}`. Seeded demo "
            f"always works."
        )


# ----------------------------------------------------------------------------
# Gradio UI
# ----------------------------------------------------------------------------

ABOUT_MARKDOWN = """
## Why MI300X matters

A single AMD Instinct MI300X (192 GB HBM3) hosts Qwen 2.5 72B at full FP16
precision and serves the three-voice ensemble plus synthesis on a single card.
The same workload on cloud APIs would need roughly 4× H100s — large GPU
memory headroom is what makes parallel ensembles economical.

|  | Cloud H100 cluster | **MI300X (single card)** |
|---|---|---|
| Memory | 80 GB × N | **192 GB HBM3** |
| Qwen 2.5 72B in FP16 | needs ≥2 GPUs | **fits on 1** |
| 3-voice ensemble + synthesis + round-2 | needs ~4× H100s | **same single card** |
| Marginal cost per debate | ~$8 cloud API | **~$0.04 self-hosted** |

## Architecture

```
                   ┌──────────────────────────────────────────┐
   POST            │   AMD Instinct MI300X (192 GB HBM3)      │
   /api/debate     │   vllm/vllm-openai-rocm                  │
   ──────────────► │   Qwen/Qwen2.5-72B-Instruct (32K ctx)    │
                   │                                          │
   3 parallel      │   ╭────────╮  ╭────────╮  ╭──────────╮   │
   voices          │   │Counsel │  │  Risk  │  │ Evidence │   │
   + synthesis     │   ╰────────╯  ╰────────╯  ╰──────────╯   │
   + (opt) round-2 │       └─────────┴────────────┘           │
                   │           ╭────────────╮                 │
                   │           │ Synthesizer│                 │
                   │           ╰────────────╯                 │
                   └──────────────────────────────────────────┘
```

## What this Space is

A Gradio-rendered companion to the full Next.js application at
[github.com/XioAISolutions/compliance-AI](https://github.com/XioAISolutions/compliance-AI).

The full app includes the live debate cockpit, securities-compliance workbench,
matter store, approval workflow, and CRUMB audit-pack export. The Hugging Face
Space focuses on two surfaces: the seeded judge demo (always works) and a
streaming-debate front-door for the live AMD endpoint.

## Built for

[AMD × lablab.ai Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer) · May 4–10, 2026
Tracks: **AI Agents & Agentic Workflows · Build in Public**

## Source

- **Repo**: [github.com/XioAISolutions/compliance-AI](https://github.com/XioAISolutions/compliance-AI)
- **PR**: [#56 — feat/amd-mi300x-vllm](https://github.com/XioAISolutions/compliance-AI/pull/56)
- **Live (full app)**: [compliance-ai-amd-demo-production.up.railway.app](https://compliance-ai-amd-demo-production.up.railway.app)
- **Release**: [v1.0.0-amd-hackathon-submission](https://github.com/XioAISolutions/compliance-AI/releases/tag/v1.0.0-amd-hackathon-submission)
- **License**: Apache-2.0

`#AMDDevHackathon` `#lablabai`
"""

with gr.Blocks(
    title="XIO Compliance Brain — Triad Review",
    theme=gr.themes.Soft(primary_hue="blue", secondary_hue="emerald"),
) as demo:
    gr.Markdown(
        """
# XIO Compliance Brain — Triad Review Engine

**Three AI reviewers — Regulatory Counsel · Risk Officer · Evidence Auditor — critique the same matter in parallel on a single AMD Instinct MI300X.**

Synthesis turns three perspectives into one decision-grade verdict. Optional Round 2 has voices defend, update, or concede their stance. Citations are verified. Output is hash-bound. Export is gated on approval. Audit rows record which inference engine served the matter — provider abstraction beats vendor lock-in.
"""
    )
    health_pill = gr.Markdown()

    with gr.Tabs():
        with gr.Tab("90-second seeded demo"):
            gr.Markdown(
                "_Pre-recorded Triad Review of an Ontario offering memorandum. No upload, no GPU spend, reads top to bottom. Always works regardless of AMD droplet state._"
            )
            gr.Markdown(render_seeded_markdown())

        with gr.Tab("Live debate · AMD MI300X"):
            gr.Markdown(
                "**Sends your input to the live `/api/debate` endpoint on AMD Instinct MI300X (Qwen 2.5 72B / vLLM).** Three voices stream concurrently against one GPU. The droplet may be intentionally stopped between demos — use the seeded tab if it isn't responding."
            )
            prompt_input = gr.Textbox(
                lines=5,
                label="Your input",
                value=DEFAULT_PROMPT,
                placeholder="Drop an OM excerpt, contract clause, regulator inquiry, or any compliance question…",
            )
            with gr.Row():
                round2_toggle = gr.Checkbox(
                    label="Round 2 — voices defend / update / concede after seeing the others",
                    value=False,
                )
                run_btn = gr.Button("▶ Run debate", variant="primary")
            output_md = gr.Markdown(label="Result")
            run_btn.click(
                stream_live_debate,
                inputs=[prompt_input, round2_toggle],
                outputs=output_md,
            )

        with gr.Tab("About / Why MI300X"):
            gr.Markdown(ABOUT_MARKDOWN)

    demo.load(health_check, outputs=health_pill)


if __name__ == "__main__":
    demo.launch()
