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
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-neutral-500">
              Demo cockpit
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              One compliance review workspace
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Start with a securities document, inspect the risk queue, trace evidence, and
              export a handoff pack. The infosec GRC path stays available in the same cockpit.
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
    </main>
  );
}
