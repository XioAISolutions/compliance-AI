#!/usr/bin/env node

const baseUrl = process.env.DEMO_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3000";

const routes = [
  "/",
  "/demo",
  "/matters",
  "/queue",
  "/approvals",
  "/controls",
  "/api/healthcheck",
  "/api/agents",
];

async function expectOk(path) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (res.status < 200 || res.status >= 400) {
    throw new Error(`${path} returned ${res.status}`);
  }
  console.log(`ok ${path} ${res.status}`);
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
}

for (const route of routes) {
  await expectOk(route);
}
await quickReviewSmoke();
console.log(`demo smoke passed for ${baseUrl}`);
