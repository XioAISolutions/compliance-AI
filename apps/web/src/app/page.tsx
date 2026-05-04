"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QuickReviewDropZone } from "./QuickReviewDropZone";
import { AuthorityLibrarySnapshot } from "./AuthorityLibrarySnapshot";
import { MatterStatsCard } from "./MatterStatsCard";

interface PingResult {
  ok: boolean;
  provider: string;
  model: string;
  baseUrl?: string;
  latencyMs: number;
  modelInfo?: { maxContextTokens: number | null };
}

const TEMPLATES = [
  {
    id: "compliance",
    label: "Compliance review",
    line: "Catch what one reviewer would miss.",
  },
  {
    id: "code-review",
    label: "Code review",
    line: "Senior · security · performance reads in one shot.",
  },
  {
    id: "decision",
    label: "Hard decision",
    line: "Three angles plus the one you missed.",
  },
  {
    id: "doc-critique",
    label: "Doc critique",
    line: "Three brutal-but-fair edits.",
  },
];

export default function Home() {
  // Bump this counter after every authority intake so the snapshot card
  // re-fetches and reflects the just-uploaded regulation without a full
  // page reload.
  const [snapshotRefreshToken, setSnapshotRefreshToken] = useState(0);
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
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* Live model status — top-right pill */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="https://github.com/XioAISolutions/compliance-AI"
          className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          target="_blank"
          rel="noopener"
        >
          XioAISolutions/compliance-AI ↗
        </Link>
        <ProviderPill ping={ping} />
      </div>

      {/* Hero — leads with the AMD multi-voice value */}
      <section className="mb-10">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Built on AMD Instinct MI300X · Qwen 2.5 72B · vLLM
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
          Three AI experts. One question.
          <br />
          <span className="text-neutral-500 dark:text-neutral-400">Side by side.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
          Most AI tools give you one answer. This one runs three at the same time —
          each from a different angle — then summarises where they agree, where
          they diverge, and what to do. All on a single AMD GPU.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/demo/debate"
            className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          >
            Open the debate →
          </Link>
          <Link
            href="/demo"
            className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Compliance workbench
          </Link>
        </div>
      </section>

      {/* Use-case quick-launch */}
      <section className="mb-12">
        <p className="mb-3 text-xs font-medium uppercase text-neutral-500">Try a use case</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => (
            <Link
              key={t.id}
              href={`/demo/debate#t=${encodeURIComponent(t.id)}`}
              className="group flex flex-col rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-900 dark:border-neutral-800 dark:hover:border-white"
            >
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="mt-1 text-xs text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
                {t.line}
              </span>
              <span className="mt-3 text-xs text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white">
                Run debate →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Why this is different */}
      <section className="mb-12">
        <p className="mb-3 text-xs font-medium uppercase text-neutral-500">Why this is different</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <ValueProp
            title="Three voices, one GPU"
            body={`MI300X has 192 GB of HBM3 — enough to host Qwen 2.5 72B AND run a three-voice ensemble on the same card. Cloud APIs would need 4× H100s for the same trick.`}
          />
          <ValueProp
            title="Citation-grade receipts"
            body={`Every finding cites a retrieved authority. CRUMB handoffs record which provider served the matter — reviews are reproducible across providers and over time.`}
          />
          <ValueProp
            title="Universal use cases"
            body={`Compliance review, code review, hard decisions, document critique — same machinery, different stances. One env-flip moves it onto your own GPU.`}
          />
        </div>
      </section>

      {/* Compliance workbench — demoted but still accessible */}
      <section className="mb-12 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase text-neutral-500">
          Have a real document?
        </p>
        <h2 className="mt-1 text-xl font-semibold">Drop it for the full compliance workflow</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          OM, KYC file, marketing deck, regulator letter — we classify, route to the right
          reviewer, cite the rules, and emit a CRUMB-style audit pack.
        </p>
        <div className="mt-4">
          <QuickReviewDropZone onAuthorityIntake={() => setSnapshotRefreshToken((t) => t + 1)} />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Hosted demo uses sample documents. Private installs run on your own AMD MI300X
          (or any OpenAI-compatible provider).
        </p>
      </section>

      <MatterStatsCard refreshToken={snapshotRefreshToken} />
      <AuthorityLibrarySnapshot refreshToken={snapshotRefreshToken} />

      {/* Deep navigation */}
      <nav className="mt-10 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        <Link
          href="/demo/debate"
          className="rounded-md bg-neutral-900 px-3 py-2 text-center text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Debate cockpit
        </Link>
        <Link
          href="/demo"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Demo cockpit
        </Link>
        <Link
          href="/queue"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Queue
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

      <footer className="mt-12 border-t border-neutral-200 pt-6 text-xs text-neutral-500 dark:border-neutral-800">
        <p>
          Built for the{" "}
          <Link
            href="https://lablab.ai/ai-hackathons/amd-developer"
            className="underline-offset-4 hover:underline hover:text-neutral-900 dark:hover:text-white"
            target="_blank"
            rel="noopener"
          >
            AMD × lablab.ai Developer Hackathon
          </Link>
          , May 2026 · #AMDDevHackathon ·{" "}
          <Link
            href="https://github.com/XioAISolutions/compliance-AI"
            className="underline-offset-4 hover:underline hover:text-neutral-900 dark:hover:text-white"
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

function ValueProp({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{body}</p>
    </div>
  );
}

function ProviderPill({ ping }: { ping: PingResult | null }) {
  const ok = ping?.ok ?? null;
  const dotClass =
    ok === true
      ? "bg-emerald-500"
      : ok === false
        ? "bg-red-500"
        : "bg-yellow-500 animate-pulse";

  return (
    <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {ping?.ok ? (
        <>
          <span className="font-medium text-neutral-700 dark:text-neutral-200">{ping.provider}</span>
          <span className="text-neutral-500">·</span>
          <span className="font-mono text-neutral-600 dark:text-neutral-300">
            {abbreviateModel(ping.model)}
          </span>
          <span className="text-neutral-500">· {ping.latencyMs}ms</span>
        </>
      ) : (
        <span className="text-neutral-500">checking provider…</span>
      )}
    </div>
  );
}

function abbreviateModel(model: string): string {
  // "Qwen/Qwen2.5-72B-Instruct" → "Qwen2.5-72B"
  // "gpt-5.4-mini" → "gpt-5.4-mini"
  if (model.includes("/")) {
    const tail = model.split("/").pop() ?? model;
    return tail.replace(/-Instruct$/i, "");
  }
  return model;
}
