"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { QuickReviewDropZone } from "../QuickReviewDropZone";
import { AssessmentRunner } from "./AssessmentRunner";
import type { DemoAssessmentResult } from "../../lib/demo/types";

type Surface = "securities" | "infosec";

const TASK_LINKS = [
  { href: "/matters", label: "Matters" },
  { href: "/queue", label: "Queue" },
  { href: "/approvals", label: "Approvals" },
  { href: "/controls", label: "Controls" },
];

export function DemoCockpitTabs({ result }: { result: DemoAssessmentResult }) {
  const [surface, setSurface] = useState<Surface>("securities");
  const topFindings = result.findings.slice(0, 4);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-neutral-200 p-1 text-sm dark:border-neutral-800">
          <SurfaceButton active={surface === "securities"} onClick={() => setSurface("securities")}>
            Securities Review
          </SurfaceButton>
          <SurfaceButton active={surface === "infosec"} onClick={() => setSurface("infosec")}>
            Infosec GRC
          </SurfaceButton>
        </div>
        <nav className="flex flex-wrap gap-2 text-xs">
          {TASK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {surface === "securities" ? (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <QuickReviewDropZone />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Step
                label="1"
                title="Classify"
                body="Matter scope is inferred from the uploaded file."
              />
              <Step
                label="2"
                title="Review"
                body="The judge loop streams a citation-backed draft."
              />
              <Step
                label="3"
                title="Handoff"
                body="Transcript, graph, and export pack travel with the matter."
              />
            </div>
          </div>
          <aside className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 className="text-lg font-semibold">Live path</h2>
            <ol className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
              <li>
                Drop an offering memorandum, KYC file, marketing document, or regulator letter.
              </li>
              <li>Open the auto-created matter and let the first review round start.</li>
              <li>Use the Transcript and Graph tabs to explain how the answer was built.</li>
              <li>Export the handoff pack before the approval step.</li>
            </ol>
            <p className="mt-5 rounded-md bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              Hosted preview uses OpenAI with sample documents. Private installs can run on your own
              AMD MI300X (vLLM + Qwen 2.5 72B), local Ollama, or any OpenAI-compatible endpoint.
            </p>
          </aside>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Infosec assessment</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Deterministic framework assessment for SOC 2, GDPR, EU AI Act, and ISO 27001.
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold">{result.readinessScore}%</div>
                <div className="text-xs text-neutral-500">ready</div>
              </div>
            </div>
            <div className="mt-5">
              <AssessmentRunner />
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Top risk queue</h2>
              <Link href="/demo/risk-queue" className="text-sm font-medium hover:underline">
                Open demo queue
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
              {topFindings.map((finding) => (
                <li key={finding.slug} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {finding.code}: {finding.title}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{finding.recommendedAction}</p>
                    </div>
                    <div className="font-mono text-lg font-semibold">{finding.priorityScore}</div>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              href="/demo/evidence"
              className="mt-5 inline-flex rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Open evidence pack
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function SurfaceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 font-medium ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

function Step({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
        {label}
      </div>
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 text-sm text-neutral-500">{body}</p>
    </div>
  );
}
