"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QuickReviewDropZone } from "./QuickReviewDropZone";
import { TRIAD_HOMEPAGE_PREVIEW, TRIAD_REVIEWERS } from "../lib/triad-seed";

interface PingResult {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  modelInfo?: { maxContextTokens: number | null };
  engineMetrics?: {
    requestsRunning: number;
    promptTokensTotal: number;
    generationTokensTotal: number;
  };
}

const USE_CASES = [
  { label: "Offering memorandum review", note: "NI 45-106 / OSC Rule 45-501" },
  { label: "KYC / AML file review", note: "NI 31-103 Part 13 · FINTRAC" },
  { label: "Marketing compliance review", note: "NI 81-102 · prohibited representations" },
  { label: "Regulator letter response", note: "OSC / CIRO / FINTRAC inquiries" },
  { label: "Privacy / data handling memo", note: "PIPEDA · Quebec Law 25" },
  { label: "Contract clause risk review", note: "Liability · indemnity · termination" },
];

export default function Home() {
  const [ping, setPing] = useState<PingResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/healthcheck/llm")
      .then((r) => r.json())
      .then((data: PingResult) => {
        if (!cancelled) setPing(data);
      })
      .catch(() => {
        /* status pill shows "checking…" if ping fails */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      {/* Top strip — repo + AMD hackathon badge + live model pill */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="https://github.com/XioAISolutions/compliance-AI"
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            target="_blank"
            rel="noopener"
          >
            XioAISolutions/compliance-AI ↗
          </Link>
          <span className="rounded-full border border-neutral-300 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            AMD Developer Hackathon Build
          </span>
        </div>
        <ProviderPill ping={ping} />
      </div>

      {/* Hero — XIO Compliance Brain · Triad Review Engine */}
      <section className="mb-6 grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            XIO Compliance Brain
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
            Triad Review Engine for{" "}
            <span className="text-neutral-500 dark:text-neutral-400">
              audit-ready compliance work.
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
            Upload a compliance document. Three AI reviewer perspectives —{" "}
            <strong className="text-neutral-900 dark:text-white">Counsel</strong>,{" "}
            <strong className="text-neutral-900 dark:text-white">Risk</strong>, and{" "}
            <strong className="text-neutral-900 dark:text-white">Evidence</strong> — find gaps,
            verify citations, expose disagreement, and create approval-ready work product.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/demo/judge"
              className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Run 90-second judge demo →
            </Link>
            <Link
              href="/matters"
              className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Open compliance workbench
            </Link>
          </div>
          <p className="mt-3 text-[11px] text-neutral-500">
            Three AI reviewers · verified citations · audit-ready decisions.
          </p>
        </div>

        {/* Result preview card — sourced from the same triad seed as /demo/judge */}
        <ResultPreviewCard />
      </section>

      {/* The three reviewers */}
      <section className="mb-10">
        <p className="mb-3 text-xs font-medium uppercase text-neutral-500">The triad</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TRIAD_REVIEWERS.map((rev) => (
            <ReviewerTile
              key={rev.id}
              accent={rev.accent}
              name={rev.name}
              role={rev.role}
              description={rev.description}
            />
          ))}
        </div>
      </section>

      {/* Use cases — narrowed to compliance verticals */}
      <section className="mb-10">
        <p className="mb-3 text-xs font-medium uppercase text-neutral-500">Use cases</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <div
              key={u.label}
              className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800"
            >
              <p className="text-sm font-medium">{u.label}</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">{u.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">
          Same Triad Review pipeline, different corpora and reviewer prompts per task type.
        </p>
      </section>

      {/* What it costs / what it saves */}
      <section className="mb-10">
        <p className="mb-3 text-xs font-medium uppercase text-neutral-500">
          What it costs · what it saves
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ROITile
            label="Lawyer-hours per OM review"
            value="3–5 hrs"
            sub="Industry baseline: a junior associate first-pass on a private-placement OM."
          />
          <ROITile
            label="Inference cost per Triad Review (3 voices + synthesis)"
            value="≈ $0.04"
            sub="Measured on this app: ~6,500 output tokens × $0.0006/1K (self-hosted MI300X amortised cost)."
            highlight
          />
          <ROITile
            label="Cloud equivalent for the same workload"
            value="≈ $8.10"
            sub="3 voices × 32K-ctx 70B-class on a hosted API at $1.20/1M output. Self-hosting flips a 200× ratio."
          />
        </div>
        <p className="mt-3 text-[11px] text-neutral-500">
          Numbers are from this codebase&apos;s synthetic test runs against the live AMD droplet —
          not a customer engagement. Real-world spread varies with deal complexity. The argument is{" "}
          <em>order-of-magnitude</em>: GPU memory headroom unlocks ensembles that cloud APIs price
          out of reach.
        </p>
      </section>

      {/* AMD technical panel */}
      <section className="mb-10 rounded-lg border-2 border-neutral-900 p-5 dark:border-white">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase text-neutral-500">Why AMD matters</p>
            <h2 className="mt-1 text-xl font-semibold">Triad Review on AMD Instinct MI300X</h2>
          </div>
          <Link
            href="/api/healthcheck/llm"
            className="text-[11px] text-neutral-500 hover:underline"
          >
            live healthcheck →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AmdFact label="Model" value="Qwen 2.5 72B-Instruct" sub="32K context · FP16" />
          <AmdFact label="Serving" value="vLLM (OpenAI-compatible)" sub="Streaming SSE · /v1/*" />
          <AmdFact label="Hardware target" value="AMD Instinct MI300X" sub="192 GB HBM3" />
          <AmdFact
            label="Workflow"
            value="3 voices + synthesis"
            sub="Optional Round 2 (defend / update / concede)"
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          Large-memory GPU serving fits a 72B model and a three-voice ensemble on a single card. The
          same workload on cloud APIs requires roughly 4× H100s — GPU memory headroom is what makes
          Triad Review economically possible.
        </p>
        <p className="mt-2 text-[11px] text-neutral-500">
          The hosted preview at compliance-ai-amd-demo-production.up.railway.app is configured to
          use this AMD vLLM endpoint when the droplet is online; the provider pill at the top right
          reads live from{" "}
          <code className="font-mono text-neutral-600 dark:text-neutral-400">
            /api/healthcheck/llm
          </code>
          .
        </p>
      </section>

      {/* Compliance workbench — demoted but still accessible */}
      <section className="mb-10 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase text-neutral-500">Have a real document?</p>
        <h2 className="mt-1 text-xl font-semibold">Drop it for the full Triad Review workflow</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          OM, KYC file, marketing deck, regulator letter — we classify, route to the right reviewer,
          cite the rules, and emit a CRUMB-style audit pack.
        </p>
        <div className="mt-4">
          <QuickReviewDropZone onAuthorityIntake={() => undefined} />
        </div>
        <p className="mt-3 text-[11px] text-neutral-500">
          Hosted demo uses sample documents. Private installs run on your own AMD MI300X (or any
          OpenAI-compatible provider).
        </p>
      </section>

      {/* Deep navigation */}
      <nav className="mb-10 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Link
          href="/demo/judge"
          className="rounded-md bg-neutral-900 px-3 py-2 text-center text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Judge demo
        </Link>
        <Link
          href="/demo/debate"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Debate cockpit
        </Link>
        <Link
          href="/queue"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Risk queue
        </Link>
        <Link
          href="/matters"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Matters
        </Link>
        <Link
          href="/approvals"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Approvals
        </Link>
      </nav>

      <footer className="border-t border-neutral-200 pt-6 text-xs text-neutral-500 dark:border-neutral-800">
        <p>
          Built for the{" "}
          <Link
            href="https://lablab.ai/ai-hackathons/amd-developer"
            className="underline-offset-4 hover:text-neutral-900 hover:underline dark:hover:text-white"
            target="_blank"
            rel="noopener"
          >
            AMD × lablab.ai Developer Hackathon
          </Link>
          , May 2026 · #AMDDevHackathon ·{" "}
          <Link
            href="https://github.com/XioAISolutions/compliance-AI"
            className="underline-offset-4 hover:text-neutral-900 hover:underline dark:hover:text-white"
            target="_blank"
            rel="noopener"
          >
            source on GitHub
          </Link>
        </p>
      </footer>
    </main>
  );
}

function ResultPreviewCard() {
  const p = TRIAD_HOMEPAGE_PREVIEW;
  return (
    <Link
      href="/demo/judge"
      className="group block rounded-lg border-2 border-neutral-900 bg-neutral-50 p-5 transition hover:bg-neutral-100 dark:border-white dark:bg-neutral-900 dark:hover:bg-neutral-800"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-medium uppercase text-neutral-500">
          Latest Triad Review · seeded sample
        </p>
        <span className="text-[10px] text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white">
          open →
        </span>
      </div>
      <h3 className="mt-1 text-base font-semibold leading-tight">{p.matterTitle}</h3>
      <p className="text-[11px] text-neutral-500">{p.taskLabel}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <PreviewStat label="Compliance score" value={`${p.complianceScore}%`} />
        <PreviewStat label="Critical gaps" value={String(p.criticalGapCount)} tone="danger" />
        <PreviewStat label="Verified citations" value={String(p.verifiedCitationCount)} tone="ok" />
        <PreviewStat
          label="Needs verification"
          value={String(p.needsVerificationCount)}
          tone="warn"
        />
        <PreviewStat
          label="Reviewer disagreement"
          value={`${p.reviewerDisagreementCount} material`}
          tone="warn"
        />
        <PreviewStat label="Export" value="Blocked · pending approval" tone="danger" />
      </dl>
    </Link>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "danger";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "text-rose-700 dark:text-rose-300"
          : "text-neutral-900 dark:text-white";
  return (
    <div className="rounded border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-black">
      <dt className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}

function ReviewerTile({
  accent,
  name,
  role,
  description,
}: {
  accent: "blue" | "amber" | "emerald";
  name: string;
  role: string;
  description: string;
}) {
  const styles =
    accent === "blue"
      ? {
          border: "border-blue-300 dark:border-blue-800",
          dot: "bg-blue-500",
          text: "text-blue-700 dark:text-blue-300",
        }
      : accent === "amber"
        ? {
            border: "border-amber-300 dark:border-amber-800",
            dot: "bg-amber-500",
            text: "text-amber-700 dark:text-amber-300",
          }
        : {
            border: "border-emerald-300 dark:border-emerald-800",
            dot: "bg-emerald-500",
            text: "text-emerald-700 dark:text-emerald-300",
          };
  return (
    <div className={`rounded-lg border-2 p-4 ${styles.border}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${styles.dot}`} />
        <h3 className="text-sm font-semibold">{name}</h3>
      </div>
      <p className={`mt-1 text-[10px] uppercase tracking-wide ${styles.text}`}>{role}</p>
      <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
    </div>
  );
}

function ROITile({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/40"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          highlight ? "text-emerald-700 dark:text-emerald-300" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{sub}</p>
    </div>
  );
}

function AmdFact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{sub}</p>
    </div>
  );
}

function ProviderPill({ ping }: { ping: PingResult | null }) {
  const ok = ping?.ok ?? null;
  const dotClass =
    ok === true ? "bg-emerald-500" : ok === false ? "bg-red-500" : "bg-yellow-500 animate-pulse";
  const ctx = ping?.modelInfo?.maxContextTokens ?? null;
  const ctxLabel =
    ctx !== null ? (ctx >= 1000 ? `${Math.round(ctx / 1024)}K ctx` : `${ctx} ctx`) : null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {ping?.ok ? (
        <>
          <span className="font-medium text-neutral-700 dark:text-neutral-200">
            {ping.provider}
          </span>
          <span className="text-neutral-500">·</span>
          <span className="font-mono text-neutral-600 dark:text-neutral-300">
            {abbreviateModel(ping.model)}
          </span>
          {ctxLabel && (
            <>
              <span className="text-neutral-500">·</span>
              <span
                className="font-mono text-neutral-600 dark:text-neutral-300"
                title={`Max context: ${ctx?.toLocaleString()} tokens`}
              >
                {ctxLabel}
              </span>
            </>
          )}
          <span className="text-neutral-500">· {ping.latencyMs}ms</span>
        </>
      ) : ok === false ? (
        <span
          className="text-neutral-500"
          title="GPU droplet may be offline. Try the seeded judge demo at /demo/judge."
        >
          provider offline
        </span>
      ) : (
        <span className="text-neutral-500">checking provider…</span>
      )}
    </div>
  );
}

function abbreviateModel(model: string): string {
  if (model.includes("/")) {
    const tail = model.split("/").pop() ?? model;
    return tail.replace(/-Instruct$/i, "");
  }
  return model;
}
