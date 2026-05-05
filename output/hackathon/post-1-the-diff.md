# Post #1 — "Triad Review on AMD" — for X / LinkedIn

> Shipped XIO Compliance Brain on a single AMD MI300X tonight. One env flip
> — `LLM_PROVIDER=amd_vllm` — moved the whole pipeline onto Qwen 2.5 72B
> running in vLLM on one GPU.
>
> Three AI reviewers — **Counsel · Risk · Evidence** — critique a real OM
> in parallel. Synthesis surfaces where they agree, where they diverge,
> and the final action. Citations carry verification badges. Output is
> bound to a SHA-256 hash; export is blocked until approved.
>
> Live (90-second seeded judge demo, no upload):
> https://compliance-ai-amd-demo-production.up.railway.app/demo/judge
>
> 192 GB of HBM3 makes the whole ensemble fit on **one** card. Cloud APIs
> would need ~4× H100s for the same trick.
>
> #AMDDevHackathon #lablabai

**Image to attach:** screenshot of `/demo/judge` showing the **One answer
vs Triad** comparison panel at the top — left column is what a generic
legal-AI chatbot would say (confident, uncited paragraph), right column
is what the Triad found (3 critical gaps · 5 verified citations · 1
material disagreement · export blocked). Tagline below: "Both took the
same input. One is dangerous in compliance."

# Post #2 — "Why three reviewers, not one"

> Most legal-AI demos give one confident answer. That's dangerous in
> compliance.
>
> XIO's Triad Review runs **three** reviewer perspectives concurrently
> against the same matter, on a single AMD MI300X. Counsel finds rule
> breaches. Risk scores severity. Evidence verifies citations and
> refuses to sign off on unsupported claims.
>
> Then a 4th call synthesises agree/diverge/verdict. Optional Round 2
> has the voices defend, update, or concede after seeing the others.
>
> Whole panel runs in ~25–35s. 192 GB of HBM3 is what makes the
> ensemble economically possible. #AMDDevHackathon

**Image to attach:** screen recording (≤30s) of `/demo/debate` running
the compliance template — the **ensemble shape panel** at the top
animates as voices stream (3 dots blinking blue → green, MI300X icon
glows emerald with live KV-cache %), voice cards fill token by token,
synthesis appears, then Round-2 stance pills land
(DEFENDED / UPDATED / CONCEDED).

# Post #3 — "The receipt"

> Every CRUMB handoff stamps which inference engine served the matter. A
> review run today on AMD/Qwen has the same audit shape as one run
> tomorrow on OpenAI. Provider abstraction beats vendor lock-in.
>
> Citation badges are real: verified / needs-check / missing /
> stale / jurisdiction-mismatch. Output hash is real. Export is gated
> on the approver matching that exact hash. The result is **audit-ready
> compliance work product**, not just an AI answer.
>
> Source: https://github.com/XioAISolutions/compliance-AI/pull/56
> Submission: HACKATHON_SUBMISSION.md in the repo
>
> #AMDDevHackathon #lablabai

**Image to attach:** screenshot of `/demo/judge` with the **Show audit
chain** disclosure expanded — 6 hash-linked rows visible, each one
showing actor · action · output hash · prev-row hash · authorities
cited · `servedBy: amd_vllm/Qwen2.5-72B`. The chain is what regulators
receive in a CRUMB handoff pack, surfaced inline so judges don't need to
download anything to see the audit shape.

---

## Posting cadence

- Post #1 — today, after submission goes live
- Post #2 — day +1, attach the screen recording from the demo video
- Post #3 — day +2, attach the CRUMB-frontmatter screenshot

Three posts with `#AMDDevHackathon` qualifies for the Build in Public
track bonus prize.
