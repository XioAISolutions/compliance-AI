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

**Image to attach:** screenshot of `/demo/judge` showing the matter strip
with 6 stat tiles (compliance score, critical gaps, verified citations,
needs-verification, reviewer disagreement, export status) and the
"Approval required before export" panel.

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
the compliance template with Round 2 enabled — voice cards filling token
by token, synthesis appearing, Round-2 stance pills landing
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

**Image to attach:** screenshot of a CRUMB handoff text file with the
`provider: amd_vllm/Qwen/Qwen2.5-72B-Instruct` line in the YAML
frontmatter highlighted.

---

## Posting cadence

- Post #1 — today, after submission goes live
- Post #2 — day +1, attach the screen recording from the demo video
- Post #3 — day +2, attach the CRUMB-frontmatter screenshot

Three posts with `#AMDDevHackathon` qualifies for the Build in Public
track bonus prize.
