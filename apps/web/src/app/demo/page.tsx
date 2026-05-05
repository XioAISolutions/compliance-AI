import Link from "next/link";
import { runDemoAssessment } from "../../lib/demo/assessment";
import { DemoCockpitTabs } from "./DemoCockpitTabs";

const result = runDemoAssessment();

export default function DemoCommandCenter() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          Back home
        </Link>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px] lg:items-end">
          <div>
            <p className="text-xs font-medium uppercase text-neutral-500">
              XIO Compliance Brain · cockpit
            </p>
            <h1 className="mt-3 text-4xl font-semibold">One workspace for the Triad Review</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Drop a document. Three reviewer perspectives — Counsel, Risk, and Evidence — find
              gaps, verify citations, expose disagreement, and create approval-ready work product.
              Built for securities compliance; the same engine serves code review, hard decisions,
              and document critique.
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              New here? Run the{" "}
              <Link
                href="/demo/judge"
                className="text-neutral-900 underline-offset-4 hover:underline dark:text-white"
              >
                90-second judge demo
              </Link>{" "}
              first — seeded Ontario OM review, no upload, reads top to bottom.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="text-xs text-neutral-500">Infosec demo readiness</div>
            <div className="mt-2 text-4xl font-semibold">{result.readinessScore}%</div>
            <div className="mt-1 text-sm text-neutral-500">{result.profile.name}</div>
          </div>
        </div>
      </header>

      <DemoCockpitTabs result={result} />

      <aside className="mt-10 rounded-lg border-2 border-neutral-900 p-5 dark:border-white">
        <p className="text-xs font-medium uppercase text-neutral-500">
          Try first · 90-second judge demo
        </p>
        <h2 className="mt-2 text-xl font-semibold">Triad Review · seeded Ontario OM</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          One click. Counsel, Risk, and Evidence have already reviewed a private-placement OM
          excerpt — read the findings, citation badges, the where-they-disagreed panel, and the
          export gate. No upload, no API call.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/demo/judge"
            className="inline-block rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Run 90-second judge demo →
          </Link>
          <Link
            href="/demo/debate"
            className="inline-block rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Or run a live debate
          </Link>
        </div>
      </aside>
    </main>
  );
}
