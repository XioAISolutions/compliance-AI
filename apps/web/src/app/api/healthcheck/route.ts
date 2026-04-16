/**
 * Healthcheck — Railway / ops probe.
 *
 * Returns 200 if the server is up, can reach the database (if configured),
 * and the cognition store responds. Returns 503 otherwise. Includes a
 * structured body with per-subsystem status for diagnostics.
 */

import { NextResponse } from "next/server";
import { getDefaultCognitionStore } from "@compliance-ai/cognition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthReport {
  status: "ok" | "degraded" | "down";
  uptime: number;
  checks: {
    cognition: { ok: boolean; securitiesSize?: number; infosecSize?: number; error?: string };
    database: { ok: boolean; configured: boolean; error?: string };
    auth: { configured: boolean };
    provider: { llmProvider: string; model: string };
  };
  version: string;
  timestamp: string;
}

const BOOT_TIME = Date.now();

export async function GET() {
  const report: HealthReport = {
    status: "ok",
    uptime: Math.floor((Date.now() - BOOT_TIME) / 1000),
    checks: {
      cognition: { ok: false },
      database: { ok: false, configured: Boolean(process.env.DATABASE_URL) },
      auth: { configured: Boolean(process.env.NEXTAUTH_SECRET) },
      provider: {
        llmProvider: process.env.LLM_PROVIDER === "openai" ? "openai" : "ollama",
        model:
          process.env.LLM_PROVIDER === "openai"
            ? (process.env.OPENAI_MODEL ?? "gpt-5.4-mini")
            : (process.env.OLLAMA_MODEL ?? process.env.OLLAMA_CHAT_MODEL ?? "llama3.1"),
      },
    },
    version: "0.8.0",
    timestamp: new Date().toISOString(),
  };

  // Cognition check
  try {
    const securities = getDefaultCognitionStore("securities");
    const infosec = getDefaultCognitionStore("infosec");
    report.checks.cognition = {
      ok: true,
      securitiesSize: await securities.size(),
      infosecSize: await infosec.size(),
    };
  } catch (err) {
    report.checks.cognition = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Database check
  if (report.checks.database.configured) {
    try {
      const { getDb } = await import("@compliance-ai/db");
      const db = getDb();
      // Cheapest possible query — SELECT 1
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      report.checks.database = { ok: true, configured: true };
    } catch (err) {
      report.checks.database = {
        ok: false,
        configured: true,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    // Not configured is fine for preview mode
    report.checks.database = { ok: true, configured: false };
  }

  // Overall status
  const allOk =
    report.checks.cognition.ok && report.checks.database.ok;
  report.status = allOk ? "ok" : "degraded";

  return NextResponse.json(report, { status: allOk ? 200 : 503 });
}
