import Link from "next/link";
import { runDemoAssessment } from "../../lib/demo/assessment";
import { DEMO_TALK_TRACK } from "../../lib/demo/scenario";
import { OPTIMIZER_NOTES } from "../../lib/demo/optimizer";
import { AssessmentRunner } from "./AssessmentRunner";

const result = runDemoAssessment();
const topFindings = result.findings.slice(0, 4);

export default function DemoCommandCenter() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← home
        </Link>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.3em] text-neutral-500">
          Launch demo layer
        </p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Compliance-AI product demo command center
            </h1>
            <p className="mt-3 max-w-3xl text-neutral-600 dark:text-neutral-400">
              A no-database, no-migration demo path that turns the existing framework catalog,
              agent loop, cognition seam, and audit-trail direction into something a buyer can
              understand in the first minute.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="text-sm text-neutral-500">Preview readiness</div>
            <div className="mt-2 text-5xl font-semibold">{result.readinessScore}%</div>
            <p className="mt-2 text-sm text-neutral-500">{result.profile.name}</p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Frameworks" value={String(result.profile.frameworks.length)} />
        <Metric label="Priority findings" value={String(result.findings.length)} />
        <Metric label="Evidence requests" value={String(result.evidencePack.length)} />
        <Metric label="Audit target" value={`${result.profile.targetAuditDays}d`} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Executive summary</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
            {result.executiveSummary}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <DemoLink href="/demo/risk-queue" title="Risk queue" body="Prioritized control worklist" />
            <DemoLink href="/demo/evidence" title="Evidence pack" body="Requests and artifacts" />
            <DemoLink href="/controls" title="Control catalog" body="Use existing chat + judge loop" />
          </div>
        </div>

        <aside className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Talk track</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            {DEMO_TALK_TRACK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Top prioritized findings</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Deterministic scoring now; QPanda/OriginQ can later replace the optimizer behind the same contract.
            </p>
          </div>
          <Link href="/demo/risk-queue" className="text-sm font-medium hover:underline">
            View all →
          </Link>
        </div>
        <div className="mt-4 divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {topFindings.map((finding) => (
            <div key={finding.slug} className="grid gap-3 p-4 md:grid-cols-[90px_1fr_110px] md:items-center">
              <div className="text-2xl font-semibold">{finding.priorityScore}</div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-xs text-neutral-500">{finding.code}</code>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-900">
                    {finding.riskLevel}
                  </span>
                </div>
                <div className="mt-1 font-medium">{finding.title}</div>
                <p className="mt-1 text-sm text-neutral-500">{finding.recommendedAction}</p>
              </div>
              <Link
                href={`/controls/${encodeURIComponent(finding.slug)}`}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-center text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Open
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <AssessmentRunner />
        <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Optimization notes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
            {OPTIMIZER_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="mt-5 rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            {result.safeDemoDisclaimer}
          </p>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
    </div>
  );
}

function DemoLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-neutral-500">{body}</div>
    </Link>
  );
}
