import Link from "next/link";
import { runDemoAssessment } from "../../../lib/demo/assessment";

const result = runDemoAssessment();

export default function RiskQueuePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <Link href="/demo" className="text-sm text-neutral-500 hover:underline">
          ← demo command center
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Prioritized risk queue</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          This is the first buyer-facing queue: one list, cross-framework, already sorted by review urgency.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <div className="grid grid-cols-[110px_100px_1.2fr_1fr_120px] gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          <div>Priority</div>
          <div>Framework</div>
          <div>Control</div>
          <div>Action</div>
          <div>Due</div>
        </div>
        {result.findings.map((finding) => (
          <div
            key={finding.slug}
            className="grid grid-cols-[110px_100px_1.2fr_1fr_120px] gap-3 border-b border-neutral-200 px-4 py-4 text-sm last:border-b-0 dark:border-neutral-800"
          >
            <div>
              <div className="text-2xl font-semibold">{finding.priorityScore}</div>
              <div className="mt-1 text-xs text-neutral-500">{finding.riskLevel}</div>
            </div>
            <div className="pt-1 uppercase text-neutral-500">{finding.framework}</div>
            <div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-neutral-500">{finding.code}</code>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-900">
                  {finding.evidenceStatus}
                </span>
              </div>
              <div className="mt-1 font-medium">{finding.title}</div>
              <p className="mt-1 text-neutral-500">{finding.rationale}</p>
            </div>
            <div>
              <p>{finding.recommendedAction}</p>
              <p className="mt-1 text-xs text-neutral-500">Owner: {finding.owner}</p>
              <Link href={`/controls/${encodeURIComponent(finding.slug)}`} className="mt-2 inline-block text-xs font-medium hover:underline">
                Open in control workspace →
              </Link>
            </div>
            <div className="pt-1 text-neutral-500">{finding.dueInDays} days</div>
          </div>
        ))}
      </div>
    </main>
  );
}
