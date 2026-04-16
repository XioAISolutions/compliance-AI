import Link from "next/link";
import { evidenceStatusLabel } from "../../../lib/demo/evidence";
import { runDemoAssessment } from "../../../lib/demo/assessment";

const result = runDemoAssessment();

export default function EvidencePackPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <Link href="/demo" className="text-sm text-neutral-500 hover:underline">
          ← demo command center
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Evidence pack</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Buyer-friendly evidence requests generated from the highest priority findings.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {result.evidencePack.map((item) => (
          <article key={item.id} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-900">
                {evidenceStatusLabel(item.status)}
              </span>
              <code className="text-xs text-neutral-500">{item.framework}</code>
              <Link
                href={`/controls/${encodeURIComponent(item.controlSlug)}`}
                className="text-xs font-medium hover:underline"
              >
                Open control →
              </Link>
            </div>
            <h2 className="mt-3 text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {item.whyItMatters}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Source" value={item.source} />
              <Row label="Request from" value={item.requestedFrom} />
            </dl>
            <div className="mt-4 rounded-xl bg-neutral-100 p-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              {item.sampleRequest}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
