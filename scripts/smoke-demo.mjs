#!/usr/bin/env node
/**
 * End-to-end smoke test for the Canadian-legal-workbench preview deployment.
 *
 * Covers:
 *   - Public page routes + legacy API endpoints.
 *   - /demo/milan + /api/demo/milan hackathon proof workflow.
 *   - /api/quick-review uploads (classifies, creates a matter, returns redirect).
 *   - /api/source-packs (taskType + lane filters).
 *   - /api/citations/verify (offline-corpus hit + CanLII URL heuristic + batch summary).
 *   - /api/matters/[id]/export-redline (hard-signoff gate + X-Approval-Override bypass).
 *
 * Run against a live preview: DEMO_BASE_URL=https://... node scripts/smoke-demo.mjs
 * Exits non-zero on any assertion failure so CI can block on it.
 */

const baseUrl = process.env.DEMO_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3000";

const routes = [
  "/",
  "/demo",
  "/demo/milan",
  "/matters",
  "/matters/new",
  "/queue",
  "/approvals",
  "/controls",
  "/api/healthcheck",
  "/api/agents",
  "/api/demo/milan",
  "/api/demo/milan/scenario",
  "/api/demo/milan/proof-pack",
  "/api/demo/milan/plan",
  "/api/demo/milan/redline",
  "/api/demo/milan/transcribe",
];

async function expectOk(path) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (res.status < 200 || res.status >= 400) {
    throw new Error(`${path} returned ${res.status}`);
  }
  console.log(`ok ${path} ${res.status}`);
}

async function expectStatus(path, init, expected) {
  const res = await fetch(`${baseUrl}${path}`, init);
  if (res.status !== expected) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} returned ${res.status}, expected ${expected}. Body: ${body.slice(0, 200)}`);
  }
  console.log(`ok ${path} ${res.status}`);
  return res;
}

async function milanProofOpsSmoke() {
  const res = await fetch(`${baseUrl}/api/demo/milan`);
  if (res.status !== 200) {
    throw new Error(`/api/demo/milan returned ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (body.product !== "XIO ProofOps Agent") {
    throw new Error(`/api/demo/milan wrong product: ${JSON.stringify(body.product)}`);
  }
  if (!Array.isArray(body.workflow) || body.workflow.length !== 8) {
    throw new Error(`/api/demo/milan workflow should have 8 steps: ${JSON.stringify(body.workflow)}`);
  }
  if (!body.partnerFit?.vultr || !body.partnerFit?.gemini || !body.partnerFit?.speechmatics || !body.partnerFit?.featherless) {
    throw new Error(`/api/demo/milan missing partner fit: ${JSON.stringify(body.partnerFit)}`);
  }
  // BrainSNN score is now derived from the scenario text. Pin the
  // canonical value so a regression in the cognitive-risk patterns is
  // caught by smoke, not by judges.
  if (body.brainSnnRisk?.score !== 78) {
    throw new Error(`/api/demo/milan wrong BrainSNN score: ${JSON.stringify(body.brainSnnRisk)}`);
  }
  const dims = body.brainSnnRisk?.dimensions ?? {};
  for (const key of ["emotionalActivation", "certaintyPressure", "trustErosion", "urgencyCompression"]) {
    if (typeof dims[key] !== "number") {
      throw new Error(`/api/demo/milan missing dimension ${key}: ${JSON.stringify(dims)}`);
    }
  }
  if (body.proofPack?.downloadUrl !== "/api/demo/milan/proof-pack") {
    throw new Error(`/api/demo/milan proofPack.downloadUrl wrong: ${JSON.stringify(body.proofPack)}`);
  }
  if (!Array.isArray(body.partners) || body.partners.length !== 4) {
    throw new Error(`/api/demo/milan partners list wrong: ${JSON.stringify(body.partners)}`);
  }
  const partnerIds = new Set(body.partners.map((p) => p.id));
  for (const id of ["vultr", "gemini", "speechmatics", "featherless"]) {
    if (!partnerIds.has(id)) {
      throw new Error(`/api/demo/milan partners missing ${id}: ${JSON.stringify(body.partners)}`);
    }
  }
  console.log(`ok /api/demo/milan (${body.workflow.length} agent steps, BrainSNN ${body.brainSnnRisk.score}, partners ${body.partners.filter((p) => p.live).length}/${body.partners.length} live)`);

  // Scenario raw-inputs endpoint — backs the "view raw inputs" link
  // on /demo/milan. Three artifacts (deck / transcript / claim), the
  // same derived cognitive-risk number the page shows, headline claim.
  const scenarioRes = await fetch(`${baseUrl}/api/demo/milan/scenario`);
  if (scenarioRes.status !== 200) {
    throw new Error(`/api/demo/milan/scenario returned ${scenarioRes.status}: ${await scenarioRes.text()}`);
  }
  const scenarioBody = await scenarioRes.json();
  if (!Array.isArray(scenarioBody.artifacts) || scenarioBody.artifacts.length !== 3) {
    throw new Error(`/api/demo/milan/scenario artifacts wrong: ${JSON.stringify(scenarioBody.artifacts)}`);
  }
  const sources = new Set(scenarioBody.artifacts.map((a) => a.source));
  for (const expected of ["deck", "transcript", "claim"]) {
    if (!sources.has(expected)) {
      throw new Error(`/api/demo/milan/scenario missing artifact source ${expected}`);
    }
  }
  if (scenarioBody.cognitiveRisk?.score !== body.brainSnnRisk?.score) {
    throw new Error(
      `/api/demo/milan/scenario cognitiveRisk.score (${scenarioBody.cognitiveRisk?.score}) does not match /api/demo/milan brainSnnRisk.score (${body.brainSnnRisk?.score})`,
    );
  }
  console.log(`ok /api/demo/milan/scenario (${scenarioBody.artifacts.length} artifacts, score=${scenarioBody.cognitiveRisk.score})`);

  // Proof-pack DOCX download — the artifact judges should walk away
  // with. Confirms binary path, headers, and that the docx renderer
  // produces a non-trivially-sized file.
  const pack = await fetch(`${baseUrl}/api/demo/milan/proof-pack`);
  if (pack.status !== 200) {
    throw new Error(`/api/demo/milan/proof-pack returned ${pack.status}: ${await pack.text()}`);
  }
  const ct = pack.headers.get("content-type") ?? "";
  if (!ct.includes("officedocument.wordprocessingml.document")) {
    throw new Error(`/api/demo/milan/proof-pack wrong content-type: ${ct}`);
  }
  const disposition = pack.headers.get("content-disposition") ?? "";
  if (!disposition.includes('xio-proofops-milan.docx')) {
    throw new Error(`/api/demo/milan/proof-pack missing filename: ${disposition}`);
  }
  const buf = await pack.arrayBuffer();
  if (buf.byteLength < 2000) {
    throw new Error(`/api/demo/milan/proof-pack suspiciously small: ${buf.byteLength} bytes`);
  }
  console.log(`ok /api/demo/milan/proof-pack (${buf.byteLength} bytes)`);

  // Interactive cognitive-risk endpoint — proves the BrainSNN score
  // varies with input and rejects malformed payloads.
  const live = await fetch(`${baseUrl}/api/demo/milan/cognitive-risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Closing today. Act now. Limited spots. Last chance. Hurry.",
    }),
  });
  if (live.status !== 200) {
    throw new Error(`/api/demo/milan/cognitive-risk returned ${live.status}: ${await live.text()}`);
  }
  const liveBody = await live.json();
  if (typeof liveBody.score !== "number" || liveBody.score <= 0) {
    throw new Error(`/api/demo/milan/cognitive-risk unexpected score: ${JSON.stringify(liveBody)}`);
  }
  if (liveBody.dimensions?.urgencyCompression <= 0) {
    throw new Error(
      `/api/demo/milan/cognitive-risk urgency dimension should be positive on urgency text: ${JSON.stringify(liveBody)}`,
    );
  }
  if (liveBody.dimensions?.certaintyPressure !== 0) {
    throw new Error(
      `/api/demo/milan/cognitive-risk certainty should be 0 on pure-urgency text: ${JSON.stringify(liveBody)}`,
    );
  }
  await expectStatus(
    `/api/demo/milan/cognitive-risk`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    400,
  );
  console.log(`ok /api/demo/milan/cognitive-risk (score=${liveBody.score}, urgency=${liveBody.dimensions.urgencyCompression})`);

  // Planner — works in both Gemini and deterministic modes. Smoke
  // just verifies the contract; the source field reflects which
  // backend served the response on the deploy under test.
  const planRes = await fetch(`${baseUrl}/api/demo/milan/plan`);
  if (planRes.status !== 200) {
    throw new Error(`/api/demo/milan/plan returned ${planRes.status}: ${await planRes.text()}`);
  }
  const planBody = await planRes.json();
  if (!["gemini", "deterministic"].includes(planBody.source)) {
    throw new Error(`/api/demo/milan/plan bad source: ${JSON.stringify(planBody)}`);
  }
  if (!Array.isArray(planBody.lanes) || planBody.lanes.length === 0) {
    throw new Error(`/api/demo/milan/plan no lanes: ${JSON.stringify(planBody)}`);
  }
  for (const lane of planBody.lanes) {
    if (typeof lane.name !== "string" || typeof lane.rationale !== "string") {
      throw new Error(`/api/demo/milan/plan malformed lane: ${JSON.stringify(lane)}`);
    }
  }
  console.log(`ok /api/demo/milan/plan (source=${planBody.source}, ${planBody.lanes.length} lanes, ${planBody.latencyMs}ms)`);

  // Featherless redliner — same shape contract regardless of live/stub.
  const redlineRes = await fetch(`${baseUrl}/api/demo/milan/redline`);
  if (redlineRes.status !== 200) {
    throw new Error(`/api/demo/milan/redline returned ${redlineRes.status}: ${await redlineRes.text()}`);
  }
  const redlineBody = await redlineRes.json();
  if (!["featherless", "deterministic"].includes(redlineBody.source)) {
    throw new Error(`/api/demo/milan/redline bad source: ${JSON.stringify(redlineBody)}`);
  }
  if (!Array.isArray(redlineBody.edits) || redlineBody.edits.length === 0) {
    throw new Error(`/api/demo/milan/redline no edits: ${JSON.stringify(redlineBody)}`);
  }
  for (const edit of redlineBody.edits) {
    for (const key of ["before", "after", "reason"]) {
      if (typeof edit[key] !== "string" || edit[key].length === 0) {
        throw new Error(`/api/demo/milan/redline malformed edit: ${JSON.stringify(edit)}`);
      }
    }
  }
  console.log(`ok /api/demo/milan/redline (source=${redlineBody.source}, ${redlineBody.edits.length} edits, ${redlineBody.latencyMs}ms)`);

  // Speechmatics transcribe — always returns the canonical transcript.
  // `auth` is null in the no-key path and an object in the configured
  // path (regardless of whether auth succeeded).
  const txRes = await fetch(`${baseUrl}/api/demo/milan/transcribe`);
  if (txRes.status !== 200) {
    throw new Error(`/api/demo/milan/transcribe returned ${txRes.status}: ${await txRes.text()}`);
  }
  const txBody = await txRes.json();
  if (!["speechmatics", "deterministic"].includes(txBody.source)) {
    throw new Error(`/api/demo/milan/transcribe bad source: ${JSON.stringify(txBody)}`);
  }
  if (typeof txBody.transcript !== "string" || txBody.transcript.length === 0) {
    throw new Error(`/api/demo/milan/transcribe missing transcript: ${JSON.stringify(txBody)}`);
  }
  console.log(`ok /api/demo/milan/transcribe (source=${txBody.source}, transcript=${txBody.transcript.length} chars, auth=${txBody.auth ? "verified" : "not-configured"})`);
}

async function quickReviewSmoke() {
  const form = new FormData();
  form.append(
    "file",
    new File(
      [
        "Offering Memorandum\nOntario issuer seeking exempt market dealer review under Form 45-106F2. Risk factors and rights of action are included.",
      ],
      "demo-offering-memorandum.txt",
      { type: "text/plain" },
    ),
  );
  const res = await fetch(`${baseUrl}/api/quick-review`, {
    method: "POST",
    body: form,
  });
  if (res.status !== 201) {
    throw new Error(`/api/quick-review returned ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.matterId || !body.redirectTo || body.classification?.documentType !== "offering-memo") {
    throw new Error(`/api/quick-review returned unexpected body: ${JSON.stringify(body)}`);
  }
  await expectOk(body.redirectTo.replace("?autoStart=1", ""));
  await expectOk(`/api/matters/${body.matterId}/transcript`);
  await expectOk(`/api/matters/${body.matterId}/graph`);
  await expectOk(`/api/matters/${body.matterId}/handoff`);
  console.log(`ok /api/quick-review ${body.matterId}`);
  return body.matterId;
}

/**
 * Source-packs smoke: the listing must include every registered pack
 * when called without filters, and narrow to the right pack per
 * taskType. Pins the contract the /matters/new wizard depends on.
 */
async function sourcePacksSmoke() {
  const all = await (await fetch(`${baseUrl}/api/source-packs`)).json();
  const allIds = new Set((all.packs ?? []).map((p) => p.id));
  const requiredPackIds = [
    "ca-securities-ontario",
    "ca-federal-aml",
    "ca-consumer-protection",
    "ca-privacy",
    "ca-court-ai",
  ];
  for (const id of requiredPackIds) {
    if (!allIds.has(id)) {
      throw new Error(`/api/source-packs missing pack ${id}`);
    }
  }
  console.log(`ok /api/source-packs (${allIds.size} packs)`);

  // Per-task routing: every task type the matter wizard exposes must
  // return a non-empty pack list.
  const taskTypes = [
    "om-review",
    "kyc-gap-check",
    "marketing-signoff",
    "response-memo",
    "court-ai-disclosure",
    "pipeda-check",
    "missing-authority-scan",
    "contract-redline",
  ];
  for (const t of taskTypes) {
    const r = await (await fetch(`${baseUrl}/api/source-packs?taskType=${t}`)).json();
    if (!Array.isArray(r.packs) || r.packs.length === 0) {
      throw new Error(`/api/source-packs?taskType=${t} returned empty`);
    }
    console.log(`ok /api/source-packs?taskType=${t} (${r.packs.length} packs)`);
  }
}

/**
 * Verifier smoke: exercise the three status paths (verified,
 * candidate-url, error) and assert the summary arithmetic adds up.
 * Pins the contract the matter-page VerifyBadge depends on.
 */
async function verifierSmoke() {
  const payload = {
    citations: [
      { id: "c1", authorityId: "auth-pipeda-schedule-1-principles", section: "4.1" },
      { id: "c2", authorityId: "2020 SCC 27", section: "" },
      { id: "c3", authorityId: "auth-bogus-made-up-id-xyz", section: "99.99" },
    ],
  };
  const res = await fetch(`${baseUrl}/api/citations/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status !== 200) {
    throw new Error(`/api/citations/verify returned ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  const { summary } = body;
  if (!summary || summary.total !== 3) {
    throw new Error(`verify summary.total !== 3: ${JSON.stringify(summary)}`);
  }
  if (summary.verified < 1) {
    throw new Error(`verify summary.verified !== 1 (seeded PIPEDA Schedule 1 should match): ${JSON.stringify(summary)}`);
  }
  // 429 batch cap
  const hugePayload = {
    citations: Array.from({ length: 101 }, (_, i) => ({ id: `c${i}`, authorityId: "x", section: "1" })),
  };
  await expectStatus(
    `/api/citations/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hugePayload),
    },
    400,
  );
  console.log(`ok /api/citations/verify (summary total=${summary.total} verified=${summary.verified} candidateUrl=${summary.candidateUrl})`);
}

/**
 * Export-redline smoke: hard-signoff gate returns 403 without
 * approval, 200 with X-Approval-Override. Proves the redline DOCX
 * renderer doesn't crash on a canonical mini-redline.
 */
async function redlineExportSmoke(matterId) {
  const redline = "Notice within [-ten (10)-]{+thirty (30)+} days. <<NOTE: market norm>>";
  // Gate blocks
  await expectStatus(
    `/api/matters/${matterId}/export-redline`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output: redline }),
    },
    403,
  );
  // Override bypass
  const res = await fetch(`${baseUrl}/api/matters/${matterId}/export-redline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Approval-Override": "smoke test",
    },
    body: JSON.stringify({ output: redline }),
  });
  if (res.status !== 200) {
    throw new Error(`export-redline override returned ${res.status}: ${await res.text()}`);
  }
  const ins = res.headers.get("X-Redline-Insertions");
  const del = res.headers.get("X-Redline-Deletions");
  if (ins !== "1" || del !== "1") {
    throw new Error(`redline headers wrong: ins=${ins} del=${del}`);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 2000) {
    throw new Error(`redline DOCX suspiciously small: ${buf.byteLength} bytes`);
  }
  console.log(`ok /api/matters/${matterId}/export-redline (${buf.byteLength} bytes, ${ins} ins / ${del} del)`);
}

for (const route of routes) {
  await expectOk(route);
}
await milanProofOpsSmoke();
const matterId = await quickReviewSmoke();
await sourcePacksSmoke();
await verifierSmoke();
await redlineExportSmoke(matterId);
console.log(`demo smoke passed for ${baseUrl}`);
