# Post #1 — "The diff" — for X / LinkedIn

> Wired our compliance brain onto a single AMD MI300X tonight. One env flip
> — `LLM_PROVIDER=amd_vllm` — moved the entire multi-agent pipeline onto
> Qwen 2.5 72B running in vLLM on one GPU. Three reviewer voices critique
> in parallel; an editor synthesises the verdict; voices defend or
> reconsider in Round 2.
>
> Live: https://compliance-ai-amd-demo-production.up.railway.app/demo/debate
>
> 192 GB of HBM3 makes the whole ensemble fit on **one** card. Cloud APIs
> would need ~4× H100s for the same trick.
>
> #AMDDevHackathon #lablabai

**Image to attach:** screenshot of `/demo/debate` showing the live status
bar (`amd_vllm → Qwen/Qwen2.5-72B-Instruct · 32K CTX · 279ms · 7 tok/s`),
the 4 use-case chips, and the Decision-making prompt. Or: screenshot of
the Round 2 cards with the DEFENDED / UPDATED stance pills visible.

# Post #2 — "The headline capability"

> The interesting thing isn't "ran inference on AMD." It's that 192 GB of
> HBM3 lets Qwen 2.5 72B host a _three-voice debate panel_ concurrently
> on one GPU. Same endpoint, three system prompts, parallel SSE streams.
>
> Then a 4th call synthesises agree/diverge/verdict. Then optional Round 2:
> voices defend, update, or concede their stance based on what the others
> said.
>
> The whole panel runs in ~25–35s. Try it: <permalink>
>
> #AMDDevHackathon

**Image to attach:** screen recording (≤30s) of `/demo/debate` running the
Decision template with Round 2 enabled — voice cards filling token by token,
synthesis appearing, Round-2 stance pills landing.

# Post #3 — "The receipt"

> Every CRUMB handoff stamps which inference engine served the matter. A
> review run today on AMD/Qwen has the same audit shape as one run
> tomorrow on OpenAI. Provider abstraction beats vendor lock-in.
>
> Bonus: the homepage's live provider pill is just `/api/healthcheck/llm`
> on a 30-second poll — green dot when the GPU is online, "provider
> offline" when not. One curl proves the model is up.
>
> Source: https://github.com/XioAISolutions/compliance-AI/pull/56
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
