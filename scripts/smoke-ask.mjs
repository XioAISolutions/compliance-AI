#!/usr/bin/env node
/**
 * End-to-end smoke test for the /ask surface.
 *
 * Exercises four scenarios:
 *   1. CA-only            - CA citations only, crossJurisdictionNote:false
 *   2. Cross-jurisdiction - both CA + US citations, crossJurisdictionNote:true
 *   3. Empty retrieval    - RETRIEVAL GAP refusal, no citations fence
 *   4. /ask page          - HTTP 200
 *
 * Usage:
 *   BASE_URL=https://compliance-ai-preview-production.up.railway.app \
 *     node scripts/smoke-ask.mjs
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TIMEOUT_MS = 180_000;

async function askStream({ question, jurisdictions }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, jurisdictions }),
    signal: controller.signal,
  });
  if (!res.ok) {
    clearTimeout(timer);
    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  }
  if (!res.body) {
    clearTimeout(timer);
    throw new Error("empty stream body");
  }
  const events = [];
  let prose = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        if (!frame.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(frame.slice(6));
          events.push(ev);
          if (ev.type === "text-delta") prose += ev.delta;
        } catch {
          /* malformed frame — skip */
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return { events, prose, status: res.status };
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`);
    failures += 1;
  }
}
const findEvent = (events, type) => events.find((e) => e.type === type);
function parseFence(prose) {
  const m = prose.match(/```citations\s*\n([\s\S]*?)\n```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return "malformed"; }
}

async function scenarioCaOnly() {
  console.log("\n[1] CA-only - NI 45-106 s. 2.9 filing requirements");
  const { events, prose } = await askStream({
    question: "What are the filing requirements under NI 45-106 section 2.9 for the offering memorandum exemption?",
    jurisdictions: ["CA"],
  });
  const p = findEvent(events, "persona-selected");
  const s = findEvent(events, "qa-summary");
  const d = findEvent(events, "done");
  check("persona-selected emitted", !!p);
  check("persona is qa-responder", p?.persona === "qa-responder");
  check("done emitted", !!d);
  check("qa-summary emitted", !!s);
  check("Plain-language summary heading", /###\s+Plain-language summary/.test(prose));
  check("Professional answer heading", /###\s+Professional answer/.test(prose));
  check("disclaimer present", /not legal advice/i.test(prose));
  if (s) {
    const ca = s.citationsByJurisdiction?.CA?.length ?? 0;
    const us = s.citationsByJurisdiction?.US?.length ?? 0;
    check("CA citations present", ca > 0, `CA=${ca}`);
    check("no US citations (CA-only call)", us === 0, `US=${us}`);
    check("crossJurisdictionNote=false (single-jurisdiction)", s.crossJurisdictionNote === false);
    check("confidence in [0,1]", typeof s.confidence === "number" && s.confidence >= 0 && s.confidence <= 1, `got ${s.confidence}`);
  }
  const f = parseFence(prose);
  check("citations fence is a JSON array", Array.isArray(f), f === null ? "no fence" : f === "malformed" ? "malformed JSON" : `type=${typeof f}`);
}

async function scenarioCross() {
  console.log("\n[2] Cross-jurisdiction - accredited investor (CA + US)");
  const { events, prose } = await askStream({
    question: "Who qualifies as an accredited investor? Compare the Canadian and US definitions.",
    jurisdictions: ["CA", "US"],
  });
  const s = findEvent(events, "qa-summary");
  check("qa-summary emitted", !!s);
  if (s) {
    const ca = s.citationsByJurisdiction?.CA?.length ?? 0;
    const us = s.citationsByJurisdiction?.US?.length ?? 0;
    check("CA citations present", ca > 0, `CA=${ca}`);
    check("US citations present", us > 0, `US=${us}`);
    check("crossJurisdictionNote=true when both present", s.crossJurisdictionNote === true);
  }
  check("Plain-language summary heading", /###\s+Plain-language summary/.test(prose));
  check("Professional answer heading", /###\s+Professional answer/.test(prose));
  check("prose mentions NI 45-106 (CA)", /NI\s?45-106/i.test(prose));
  check("prose mentions Rule 501 or Regulation D (US)", /rule\s?501|regulation\s?d/i.test(prose));
  check("disclaimer present", /not legal advice/i.test(prose));
  const f = parseFence(prose);
  check("citations fence has >= 2 entries", Array.isArray(f) && f.length >= 2, f === null ? "no fence" : `n=${Array.isArray(f) ? f.length : "?"}`);
}

async function scenarioEmpty() {
  console.log("\n[3] Empty retrieval - Singapore MAS (not in corpus)");
  const { events, prose } = await askStream({
    question: "Explain the licensing process under the Singapore MAS for a capital markets services licence.",
    jurisdictions: ["CA", "US"],
  });
  const s = findEvent(events, "qa-summary");
  check("qa-summary emitted", !!s);
  check("RETRIEVAL GAP notice present", /RETRIEVAL GAP/i.test(prose));
  check("no citations fence in refusal", !/```citations/.test(prose));
  if (s) {
    check("confidence low (<= 0.5) for refusal", s.confidence <= 0.5, `got ${s.confidence}`);
  }
  check("disclaimer present on refusal", /not legal advice/i.test(prose));
}

async function scenarioPage() {
  console.log("\n[4] /ask page - HTTP 200");
  const res = await fetch(`${BASE}/ask`);
  check("/ask returns 200", res.status === 200, `status=${res.status}`);
  const html = await res.text();
  check("page HTML contains form heading", /Ask the compliance brain/i.test(html));
}

async function main() {
  console.log(`Smoke target: ${BASE}`);
  await scenarioPage();
  await scenarioCaOnly();
  await scenarioCross();
  await scenarioEmpty();
  console.log("");
  if (failures > 0) {
    console.log(`FAILED - ${failures} assertion${failures === 1 ? "" : "s"} did not pass`);
    process.exit(1);
  }
  console.log("ALL GREEN");
}

main().catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
