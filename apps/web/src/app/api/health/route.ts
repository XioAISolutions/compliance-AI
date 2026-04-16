/**
 * GET /api/health — liveness + readiness probe for Railway / Fly / k8s.
 *
 * Returns 200 + `{ status: "ok", uptime, version, checks }` when every
 * synchronous dependency is reachable; 503 otherwise. Kept deliberately
 * cheap — this endpoint gets hit every 30s by the platform.
 */

import { NextResponse } from "next/server";
import { getDefaultMatterStore } from "../../../lib/matter-store";
import { getDefaultCognitionStore } from "@compliance-ai/cognition";
import { getDefaultTranscriptStore } from "@compliance-ai/chat-structure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const started = Date.now();

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  let ok = true;

  // Matter store — in-memory singleton must be resolvable.
  try {
    const ms = getDefaultMatterStore();
    checks.matterStore = { ok: true, detail: `${ms.size()} matters` };
  } catch (e) {
    ok = false;
    checks.matterStore = {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  // Cognition — check both surfaces can initialize.
  try {
    const securities = getDefaultCognitionStore("securities");
    const infosec = getDefaultCognitionStore("infosec");
    const size = (await securities.size()) + (await infosec.size());
    checks.cognition = { ok: true, detail: `${size} items across surfaces` };
  } catch (e) {
    ok = false;
    checks.cognition = {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  // Transcript store — singleton check.
  try {
    getDefaultTranscriptStore();
    checks.transcript = { ok: true };
  } catch (e) {
    ok = false;
    checks.transcript = {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  // Anthropic API key presence (we don't call the API from this route;
  // existence is enough for a readiness signal).
  checks.anthropic = {
    ok: Boolean(process.env.ANTHROPIC_API_KEY),
    detail: process.env.ANTHROPIC_API_KEY ? "key present" : "ANTHROPIC_API_KEY not set",
  };

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      uptimeMs: Date.now() - started,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
      commit: process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown",
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
