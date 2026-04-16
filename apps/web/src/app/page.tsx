"use client";

/**
 * Home page — product orientation + live health beacon + quick links.
 *
 * The health beacon is a low-noise trust signal for anyone hitting the
 * deployment cold: if /api/health comes back degraded, they see it before
 * clicking into a broken flow. Cached for 30s so we don't DOS ourselves
 * on refresh.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

interface HealthPayload {
  status: "ok" | "degraded";
  uptimeMs: number;
  version: string;
  commit: string;
  checks: Record<string, { ok: boolean; detail?: string }>;
}

export default function Home() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as HealthPayload;
        if (!cancelled) setHealth(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "unreachable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statusColor = !health
    ? "bg-neutral-400"
    : health.status === "ok"
      ? "bg-green-500"
      : "bg-amber-500";

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-semibold tracking-tight">XIO Compliance Brain</h1>
        <div
          className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-xs dark:border-neutral-800"
          title={
            error
              ? `health unreachable: ${error}`
              : health
                ? `${health.status} · uptime ${formatUptime(health.uptimeMs)} · v${health.version}`
                : "checking…"
          }
        >
          <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
          <span className="text-neutral-500">
            {error ? "offline" : health ? health.status : "checking…"}
          </span>
        </div>
      </div>
      <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
        Citation-first securities compliance workbench.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Review offering memoranda, run KYC gap checks, sign off on marketing materials,
        and draft response memos — with structured citations back to the source rules.
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        Cloud inference via Anthropic with enterprise zero-retention on your documents.
      </p>

      <nav className="mt-10 space-y-3">
        <Link
          href="/matters"
          className="flex items-center gap-3 rounded-lg border border-neutral-300 px-5 py-3 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-xs font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
            OM
          </span>
          <div>
            <span className="text-sm font-medium">Open matters</span>
            <p className="text-xs text-neutral-500">
              Create or continue a securities compliance review — three-pane
              workbench with Output / Transcript / Graph tabs
            </p>
          </div>
        </Link>
        <Link
          href="/controls"
          className="flex items-center gap-3 rounded-lg border border-neutral-200 px-5 py-3 text-neutral-400 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 text-xs font-bold text-neutral-400 dark:bg-neutral-900">
            GRC
          </span>
          <div>
            <span className="text-sm font-medium">Infosec control catalog</span>
            <p className="text-xs text-neutral-400">
              SOC 2, GDPR, EU AI Act, ISO 27001 — separate surface, isolated
              cognition corpus
            </p>
          </div>
        </Link>
      </nav>

      <footer className="mt-16 grid gap-2 border-t border-neutral-200 pt-6 text-[11px] text-neutral-400 dark:border-neutral-800">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a href="/api/health" className="hover:text-neutral-600 dark:hover:text-neutral-300">
            health
          </a>
          <a href="/api/version" className="hover:text-neutral-600 dark:hover:text-neutral-300">
            version
          </a>
          <a href="/api/agents" className="hover:text-neutral-600 dark:hover:text-neutral-300">
            agents
          </a>
          <a
            href="https://github.com/XioAISolutions/compliance-AI"
            className="hover:text-neutral-600 dark:hover:text-neutral-300"
            target="_blank"
            rel="noreferrer"
          >
            source
          </a>
        </div>
        {health?.commit && health.commit !== "unknown" && (
          <span className="font-mono">
            v{health.version} · {health.commit.slice(0, 7)}
          </span>
        )}
      </footer>
    </main>
  );
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
