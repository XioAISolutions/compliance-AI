#!/usr/bin/env node
/**
 * Live-mode smoke for the Milan submission.
 *
 *   DEMO_BASE_URL=https://… node scripts/smoke-live.mjs
 *
 * Stricter than `scripts/smoke-demo.mjs`. The plain demo smoke stays
 * credential-free so CI passes everywhere; this one asserts that the
 * deploy has actually wired the partner keys correctly:
 *
 *   - /api/demo/milan          → partners[].live === true for >= 3 of 4
 *   - /api/demo/milan/plan     → source === "gemini"
 *   - /api/demo/milan/redline  → source === "featherless"
 *   - /api/demo/milan/transcribe → source === "speechmatics", auth.ok === true
 *   - /api/demo/milan/proof-pack → X-ProofPack-{Plan,Redline,Transcript}-Source
 *                                  headers match the partner names (not "deterministic")
 *
 * Exits non-zero on any failure so a deploy pipeline can block on it.
 *
 * Vultr is "live" if VULTR_DEPLOY=1 OR VULTR_API_KEY is set on the host;
 * we don't make a runtime API call to verify, so it's the one partner
 * that always reports `live: true` if the deploy was configured at all.
 */

const baseUrl = process.env.DEMO_BASE_URL || process.env.BASE_URL;
if (!baseUrl) {
  console.error("smoke:live requires DEMO_BASE_URL (e.g. https://xio-proofops.example.com)");
  process.exit(2);
}

async function getJson(path) {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function assertPartnersLive() {
  const body = await getJson("/api/demo/milan");
  if (!Array.isArray(body.partners) || body.partners.length !== 4) {
    throw new Error(`partners[] should have 4 entries, got: ${JSON.stringify(body.partners)}`);
  }
  const live = body.partners.filter((p) => p.live);
  const stub = body.partners.filter((p) => !p.live);
  console.log(`  partners live: ${live.map((p) => p.id).join(", ") || "(none)"}`);
  if (stub.length > 0) {
    console.log(`  partners still on stub: ${stub.map((p) => p.id).join(", ")}`);
  }
  if (live.length < 3) {
    throw new Error(
      `expected >= 3 live partners, got ${live.length}. Check env vars + sponsor allowlists.`,
    );
  }
}

async function assertPlanLive() {
  const body = await getJson("/api/demo/milan/plan");
  if (body.source !== "gemini") {
    throw new Error(
      `plan.source !== "gemini" — got "${body.source}" (model=${body.model}, err=${body.error ?? "none"}).` +
        " Set GEMINI_API_KEY (+ GEMINI_VERTEX_PROJECT if using a Vertex key) on the host.",
    );
  }
  console.log(`  plan: gemini ${body.model} · ${body.lanes.length} lanes · ${body.latencyMs}ms`);
}

async function assertRedlineLive() {
  const body = await getJson("/api/demo/milan/redline");
  if (body.source !== "featherless") {
    throw new Error(
      `redline.source !== "featherless" — got "${body.source}" (model=${body.model}, err=${body.error ?? "none"}).` +
        " Set FEATHERLESS_API_KEY and add the deploy IP to the Featherless allowlist.",
    );
  }
  console.log(`  redline: featherless ${body.model} · ${body.edits.length} edits · ${body.latencyMs}ms`);
}

async function assertTranscribeLive() {
  const body = await getJson("/api/demo/milan/transcribe");
  if (body.source !== "speechmatics") {
    throw new Error(
      `transcribe.source !== "speechmatics" — got "${body.source}" (auth=${JSON.stringify(body.auth)}).` +
        " Set SPEECHMATICS_API_KEY and allowlist the deploy IP.",
    );
  }
  if (!body.auth?.ok) {
    throw new Error(`transcribe.auth.ok !== true: ${JSON.stringify(body.auth)}`);
  }
  console.log(`  transcribe: speechmatics auth.ok · ${body.auth.latencyMs}ms`);
}

async function assertProofPackHeaders() {
  const res = await fetch(`${baseUrl}/api/demo/milan/proof-pack`);
  if (res.status !== 200) {
    throw new Error(`/api/demo/milan/proof-pack returned ${res.status}`);
  }
  const plan = res.headers.get("x-proofpack-plan-source");
  const redline = res.headers.get("x-proofpack-redline-source");
  const transcript = res.headers.get("x-proofpack-transcript-source");
  if (plan !== "gemini") throw new Error(`X-ProofPack-Plan-Source = "${plan}", expected "gemini"`);
  if (redline !== "featherless") throw new Error(`X-ProofPack-Redline-Source = "${redline}", expected "featherless"`);
  if (transcript !== "speechmatics") throw new Error(`X-ProofPack-Transcript-Source = "${transcript}", expected "speechmatics"`);
  await res.arrayBuffer();
  console.log(`  proof-pack headers: plan=${plan}, redline=${redline}, transcript=${transcript}`);
}

console.log(`smoke:live against ${baseUrl}`);

await assertPartnersLive();
await assertPlanLive();
await assertRedlineLive();
await assertTranscribeLive();
await assertProofPackHeaders();

console.log(`\nlive smoke passed for ${baseUrl}`);
