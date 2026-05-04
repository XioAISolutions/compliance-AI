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
            <h1 className="mt-3 text-4xl font-semibold">One compliance review workspace</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Start with a securities document, inspect the risk queue, trace evidence, and export a
              handoff pack. The infosec path stays available in the same cockpit.
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

      <aside className="mt-10 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-xs font-medium uppercase text-neutral-500">
          Hackathon track · multi-voice debate
        </p>
        <h2 className="mt-2 text-xl font-semibold">Three reviewers, one GPU</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Skeptical, permissive, and regulator voices critique the same OM in parallel against a
          single Qwen 2.5 72B endpoint on AMD MI300X.
        </p>
        <Link
          href="/demo/debate"
          className="mt-3 inline-block text-sm font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-white"
        >
          Open debate cockpit →
        </Link>
      </aside>
    </main>
  );
}
