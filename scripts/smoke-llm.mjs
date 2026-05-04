#!/usr/bin/env node
/**
 * Standalone CLI smoke for the configured LLM provider.
 *
 * Usage:
 *   LLM_PROVIDER=amd_vllm AMD_VLLM_BASE_URL=http://<ip>:8000/v1 node scripts/smoke-llm.mjs
 *   AMD_VLLM_BASE_URL=http://<ip>:8000/v1 node scripts/smoke-llm.mjs   # auto-detects amd_vllm
 *
 * Hits /v1/models and /v1/chat/completions on the resolved provider, prints
 * latency + sample output. Exits 0 on success, 1 on failure. Doesn't touch
 * Next.js — useful for verifying the GPU side from CI or a hackathon demo
 * machine without booting the web app.
 */

const args = process.argv.slice(2);
const arg = (key, fallback) => {
  const idx = args.findIndex((a) => a === `--${key}`);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
};

const baseUrl = (
  process.env.AMD_VLLM_BASE_URL ??
  process.env.OPENAI_BASE_URL ??
  process.env.OLLAMA_BASE_URL ??
  arg("base-url", null)
)?.replace(/\/+$/, "");
if (!baseUrl) {
  console.error("smoke-llm: no base URL set. Pass --base-url or set AMD_VLLM_BASE_URL.");
  process.exit(1);
}
const baseV1 = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;

const model =
  process.env.AMD_VLLM_MODEL ??
  process.env.OPENAI_MODEL ??
  process.env.OLLAMA_MODEL ??
  arg("model", "Qwen/Qwen2.5-72B-Instruct");

const apiKey =
  process.env.AMD_VLLM_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.OLLAMA_API_KEY ?? null;

const prompt = arg("prompt", 'Respond with the single word "ready" and nothing else.');

const headers = {
  "Content-Type": "application/json",
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
};

async function listModels() {
  const res = await fetch(`${baseV1}/models`, { headers });
  if (!res.ok) throw new Error(`/v1/models → ${res.status}`);
  return res.json();
}

async function complete() {
  const startedAt = Date.now();
  const res = await fetch(`${baseV1}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 32,
    }),
  });
  if (!res.ok)
    throw new Error(`/v1/chat/completions → ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  const sample = json.choices?.[0]?.message?.content ?? "";
  return { sample, latencyMs: Date.now() - startedAt, usage: json.usage };
}

(async () => {
  console.log(`smoke-llm: target ${baseV1} model=${model} prompt="${prompt}"`);
  try {
    const models = await listModels();
    const ids = (models.data ?? []).map((m) => m.id).join(", ") || "(none)";
    console.log(`  ✓ /v1/models → [${ids}]`);
    const { sample, latencyMs, usage } = await complete();
    console.log(`  ✓ /v1/chat/completions → "${sample.trim()}" in ${latencyMs}ms`);
    if (usage) console.log(`  · usage: ${JSON.stringify(usage)}`);
    console.log("smoke-llm: PASS");
    process.exit(0);
  } catch (err) {
    console.error(`smoke-llm: FAIL — ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
})();
