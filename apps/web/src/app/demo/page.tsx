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
            <p className="text-xs font-medium uppercase text-neutral-500">Demo cockpit</p>
            <h1 className="mt-3 text-4xl font-semibold">One workspace for the whole review</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Drop a document. AI reviews it, cites the rules, and surfaces what to fix — with an
              audit trail you can hand off. Built for securities compliance, but the multi-voice
              debate panel works for any review where multiple perspectives beat one.
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              New here? Try the{" "}
              <Link
                href="/demo/debate"
                className="text-neutral-900 underline-offset-4 hover:underline dark:text-white"
              >
                three-voice debate
              </Link>{" "}
              first — it&apos;s the most self-explanatory surface.
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
          Try first · multi-voice debate
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          Three AI experts. One question. Side by side.
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Most AI tools give one answer. This runs three in parallel — each from a different angle —
          then summarises where they agree, where they diverge, and what to do. Works for compliance
          review, code review, hard decisions, and document critique.
        </p>
        <Link
          href="/demo/debate"
          className="mt-3 inline-block rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          Open the debate →
        </Link>
      </aside>
    </main>
  );
}
