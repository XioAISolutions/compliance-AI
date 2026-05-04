# compliance-brain on AMD MI300X

This branch wires the entire multi-agent compliance pipeline onto a self-hosted
**Qwen 2.5 72B** running on a single **AMD Instinct MI300X** via vLLM.
A single env flip (`LLM_PROVIDER=amd_vllm`) moves every agent call —
classifier, drafter, judge, OM/KYC/marketing reviewers, citation verifier —
onto the new endpoint. All other provider paths (OpenAI, Ollama, Anthropic)
remain fully supported.

The headline surface is **`/demo/debate`**: three AI experts critique any input
in parallel, on a single GPU. After the panel resolves, an editor LLM
synthesises where the voices agreed, where they diverged, and the verdict.
Optional Round 2: voices respond to each other and to the synthesis, defending
or updating their stance — a literal demonstration of MI300X memory headroom.

## Try it in 60 seconds

```bash
# Point the app at the live AMD droplet
cat > apps/web/.env.local <<'ENV'
LLM_PROVIDER=amd_vllm
AMD_VLLM_BASE_URL=http://129.212.190.73:8000/v1
AMD_VLLM_MODEL=Qwen/Qwen2.5-72B-Instruct
ENV

pnpm install
pnpm smoke:llm                 # 1-shot CLI ping → "ready" in ~200ms
pnpm dev:web                   # → http://localhost:3000/demo/debate
```

## Surfaces added on this branch

| Surface                              | What                                                                                                                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                              | Hackathon-grade landing — hero, live provider pill (with model + ctx + latency), 4 use-case quick-launch cards, value props, footer.                                             |
| `GET /demo/debate`                   | Three-voice cockpit. Pick a use case (or paste your own). Get one verdict + agreed/diverged bullets. Optional Round 2.                                                           |
| `GET /demo/debate#t=<id>&q=<base64>` | Permalink — encoded prompt + template hydrate the cockpit on load. Hash never hits the server.                                                                                   |
| `POST /api/debate`                   | SSE-streamed multi-voice panel + synthesis + (optional) round-2 follow-up. Returns voice-started / voice-delta / voice-completed / synthesis / followup-\* / debate-done events. |
| `GET /api/healthcheck/llm`           | Live ping of the configured provider. Reports latency, sample, output tokens, tokens/sec, model context length (when supported), and inference engine.                           |
| `pnpm smoke:llm`                     | Standalone CLI provider ping (no Next.js needed).                                                                                                                                |

The CRUMB handoff (`/api/matters/<id>/handoff`) stamps a `provider:` line in
the YAML frontmatter so receipts record which inference engine served the
matter. The audit row's free-text summary stamps `served by <provider>/<model>`.

## What "uses the AMD MI300X" visibly

1. **Live tokens-per-second pill** — emerald pill in the cockpit toolbar
   while a debate streams. Computed from chars-per-second over a sliding
   window across all concurrent voices. Judges see throughput live.
2. **Context window pill** — provider bar shows `32K ctx` (Qwen 2.5 72B
   on vLLM) directly from `/v1/models`. Concrete proof of memory headroom.
3. **Round-2 follow-up** — checkbox enables a second parallel batch where
   each voice defends, updates, or concedes its stance based on the
   synthesis and the others. Cards land with `defended` / `updated` /
   `conceded` pills. Real second-order GPU compute, visible to the viewer.
4. **Same-GPU panel** — the entire 3-voice debate + synthesis (+ optional
   round-2) runs against ONE vLLM endpoint on ONE MI300X. The concurrency
   story is "192 GB HBM3 holds Qwen 2.5 72B and serves an ensemble at
   once."

## Universal use-case templates

Click a chip on `/demo/debate` (or the home page) to swap the panel:

| Template          | Voices                                                | When to use                                                                         |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Compliance review | Skeptical · Permissive · Regulator                    | Reviewing a legal/regulatory document; want to catch what one reviewer would miss.  |
| Code review       | Senior engineer · Security auditor · Performance hawk | Shipping a PR; want senior + security + perf reads in one shot.                     |
| Decision making   | Optimist · Skeptic · Devil's advocate                 | Stuck between two options; want the case for each plus the one you didn't consider. |
| Document critique | Strict editor · Confused reader · Subject expert      | Wrote something (landing page, memo, pitch); want three brutal-but-fair edits.      |

Voices are editable in the cockpit ("edit voices" link). You can also add a
4th, rename, swap stances — the engine accepts any `DebateVoice[]`.

## Env vars

```bash
LLM_PROVIDER=amd_vllm           # required to select this provider
AMD_VLLM_BASE_URL=...           # required; with or without /v1 suffix
AMD_VLLM_MODEL=...              # default: Qwen/Qwen2.5-72B-Instruct
AMD_VLLM_API_KEY=...            # optional; vLLM serves unauthenticated by default
```

If `LLM_PROVIDER` is unset, runtime auto-detect prefers `AMD_VLLM_BASE_URL`
over OpenAI / Anthropic / Ollama — explicit endpoint trumps ambient
credentials.

## Verified live

- `pnpm smoke:llm` against the live endpoint → "ready" in **~200 ms**
- `/api/healthcheck/llm` round-trip → ~250–320 ms through the production code
  path; reports `outputTokens`, `tokensPerSec`, and `modelInfo.maxContextTokens`
- `/demo/debate` end-to-end (compliance, decision, code-review, doc-critique
  templates) → 3/3 voices in 19–38 s wall on a single MI300X depending on
  template and output length
- Round-2 follow-up adds another 6–12 s of parallel inference; cards land
  with stance pills (`defended` / `updated` / `conceded`)
- Permalinks work (`/demo/debate#t=decision&q=<base64>`)
- Copy-full-report stitches verdict + agreed + diverged + every voice into
  one markdown blob
- 336 unit tests passing + 1 AMD live smoke (skipped unless
  `AMD_VLLM_BASE_URL` set), lint clean, typecheck clean across 9 packages
- Railway preview unchanged (still openai/gpt-5.4-mini); no regressions

## Hackathon

Built for the [AMD x lablab.ai Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer)
(May 4–10, 2026). Tracks: AI Agents & Agentic Workflows · Build in Public.
