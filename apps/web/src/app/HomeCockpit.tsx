"use client";

/**
 * HomeCockpit — the single entry-point to the workspace.
 *
 * Collapses the old separate `/` landing page and `/demo` cockpit into one
 * surface-switched cockpit on the root route, so a prospect isn't split
 * between "home page" and "demo page" showing overlapping copy. The
 * securities upload path and the infosec GRC path now live side-by-side
 * under the same switch and share the same matter / queue / approval nav.
 *
 * Surface-aware nav (the #5 fix): the Infosec catalog link only shows
 * when the user is actually on the infosec surface, so a lawyer dropping
 * an OM doesn't see dead-end nav to a catalog they don't use.
 */

import { useState } from "react";
import Link from "next/link";
import { QuickReviewDropZone } from "./QuickReviewDropZone";
import { AuthorityLibrarySnapshot } from "./AuthorityLibrarySnapshot";
import { MatterStatsCard } from "./MatterStatsCard";
import { AssessmentRunner } from "./demo/AssessmentRunner";
import type { DemoAssessmentResult } from "../lib/demo/types";

type Surface = "securities" | "infosec";

const NAV_CLS =
  "rounded-md border border-neutral-200 px-3 py-1.5 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900";

export function HomeCockpit({ assessment }: { assessment: DemoAssessmentResult }) {
  const [surface, setSurface] = useState<Surface>("securities");
  const [snapshotRefreshToken, setSnapshotRefreshToken] = useState(0);
  const topFindings = assessment.findings.slice(0, 4);

  return (
    <>
      <div className="mb-8">
        <h1 className="text-4xl font-semibold">XIO Compliance Brain</h1>
        <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
          Private compliance review workbench for lawyers and regulated firms.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Hosted preview uses sample documents. Private installs can keep everything on local
          Ollama.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-neutral-200 p-1 text-sm dark:border-neutral-800">
          <SurfaceButton active={surface === "securities"} onClick={() => setSurface("securities")}>
            Securities Review
          </SurfaceButton>
          <SurfaceButton active={surface === "infosec"} onClick={() => setSurface("infosec")}>
            Infosec GRC
          </SurfaceButton>
        </div>
        {/* Surface-aware nav — lawyers reviewing securities documents don't
            need a catalog link; infosec users don't need a matter queue. */}
        <nav className="flex flex-wrap gap-2 text-xs">
          {surface === "securities" ? (
            <>
              <Link href="/queue" className={NAV_CLS}>
                Today&apos;s queue
              </Link>
              <Link href="/matters" className={NAV_CLS}>
                All matters
              </Link>
              <Link href="/approvals" className={NAV_CLS}>
                Approvals
              </Link>
            </>
          ) : (
            <>
              <Link href="/controls" className={NAV_CLS}>
                Infosec catalog
              </Link>
              <Link href="/demo/risk-queue" className={NAV_CLS}>
                Risk queue
              </Link>
              <Link href="/demo/evidence" className={NAV_CLS}>
                Evidence pack
              </Link>
            </>
          )}
        </nav>
      </div>

      {surface === "securities" ? (
        <section>
          <QuickReviewDropZone
            onAuthorityIntake={() => setSnapshotRefreshToken((t) => t + 1)}
          />
          <p className="mt-3 text-xs text-neutral-400">
            We&apos;ll detect whether it&apos;s an offering memo, KYC file, marketing deck, or
            regulator letter, and route it to the right reviewer automatically.
          </p>
          <MatterStatsCard refreshToken={snapshotRefreshToken} />
          <AuthorityLibrarySnapshot refreshToken={snapshotRefreshToken} />
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
                <div className="text-3xl font-semibold">{assessment.readinessScore}%</div>
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
    </>
  );
}

function SurfaceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
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
