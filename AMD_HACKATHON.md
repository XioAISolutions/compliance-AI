# compliance-brain on AMD MI300X

This branch wires the entire multi-agent compliance pipeline onto a self-hosted
**Qwen 2.5 72B** running on a single **AMD Instinct MI300X** via vLLM.
A single env flip (`LLM_PROVIDER=amd_vllm`) moves every agent call —
classifier, drafter, judge, OM/KYC/marketing reviewers, citation verifier —
onto the new endpoint. All other provider paths (OpenAI, Ollama, Anthropic)
remain fully supported.

## Try it in 60 seconds

```bash
# point the app at the live AMD droplet
cat > apps/web/.env.local <<'ENV'
LLM_PROVIDER=amd_vllm
AMD_VLLM_BASE_URL=http://129.212.190.73:8000/v1
AMD_VLLM_MODEL=Qwen/Qwen2.5-72B-Instruct
ENV

pnpm install
pnpm smoke:llm                 # 1-shot CLI ping → "ready" in ~200ms
pnpm dev:web                   # → http://localhost:3000/demo/debate
```

The `/demo/debate` cockpit fires three reviewer voices (skeptical, permissive,
regulator) at the same Qwen endpoint in parallel. The status bar at the top
of the page is a live ping of `/api/healthcheck/llm` — if the droplet is up
the dot is green and you'll see `amd_vllm → Qwen/Qwen2.5-72B-Instruct`.

## Surfaces added on this branch

| Surface                     | What                                                                      |
| --------------------------- | ------------------------------------------------------------------------- |
| `GET  /demo/debate`         | Three-voice debate cockpit; click "Run debate" to fire 3 parallel reviews |
| `POST /api/debate`          | SSE-streamed multi-voice panel; consumed by `/demo/debate`                |
| `GET  /api/healthcheck/llm` | Live ping of the configured provider; reports latency + sample            |
| `pnpm smoke:llm`            | Standalone CLI provider ping (no Next.js needed)                          |

The CRUMB handoff (`/api/matters/<id>/handoff`) gains a `provider:` line in
the YAML frontmatter so receipts record which inference engine served the
matter. The audit row's free-text summary stamps `served by <provider>/<model>`.

## Env vars

```bash
LLM_PROVIDER=amd_vllm           # required to select this provider
AMD_VLLM_BASE_URL=...           # required; with or without /v1 suffix
AMD_VLLM_MODEL=...              # default: Qwen/Qwen2.5-72B-Instruct
AMD_VLLM_API_KEY=...            # optional; vLLM serves unauthenticated by default
```

If `LLM_PROVIDER` is unset, runtime auto-detect prefers `AMD_VLLM_BASE_URL`
over OpenAI / Anthropic / Ollama — explicit endpoint trumps ambient credentials.

## What's verified

- `pnpm smoke:llm` against the live endpoint → "ready" in **211 ms**
- `/api/healthcheck/llm` round-trip → **236 ms** through the production code path
- `/demo/debate` end-to-end → **3/3 voices in 35.6 s wall** on a single MI300X
- 334 unit tests passing + 1 AMD live smoke (skipped unless `AMD_VLLM_BASE_URL` set)
- `next build` registers `/api/debate`, `/demo/debate`, `/api/healthcheck/llm`
- Railway preview unchanged (still openai/gpt-5.4-mini)

## Hackathon

Built for the [AMD x lablab.ai Developer Hackathon](https://lablab.ai/ai-hackathons/amd-developer)
(May 4–10, 2026). Tracks: AI Agents & Agentic Workflows, Build in Public.
