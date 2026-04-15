import { CATALOGS, type CatalogEntry, type FrameworkId } from "@compliance-ai/frameworks";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatPanel } from "./ChatPanel";

const FRAMEWORK_LABEL: Record<FrameworkId, string> = {
  soc2: "SOC 2",
  gdpr: "GDPR",
  "eu-ai-act": "EU AI Act",
  "iso-27001": "ISO 27001",
};

function findEntry(slug: string): CatalogEntry | null {
  for (const entries of Object.values(CATALOGS)) {
    const hit = entries.find((e) => e.slug === slug);
    if (hit) return hit;
  }
  return null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ControlDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const entry = findEntry(decodeURIComponent(slug));
  if (!entry) notFound();

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[3fr_2fr]">
      <section>
        <Link href="/controls" className="text-sm text-neutral-500 hover:underline">
          ← all controls
        </Link>
        <div className="mt-2 flex items-baseline gap-3">
          <code className="text-sm text-neutral-500">{entry.code}</code>
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {FRAMEWORK_LABEL[entry.framework]}
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{entry.title}</h1>
        <p className="mt-3 text-neutral-700 dark:text-neutral-300">{entry.description}</p>

        <ControlMetadata entry={entry} />
      </section>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <ChatPanel controlSlug={entry.slug} controlTitle={entry.title} />
      </aside>
    </main>
  );
}

/**
 * Renders the framework-specific fields. Discriminated by `framework` so the
 * type narrows automatically — no casts needed.
 */
function ControlMetadata({ entry }: { entry: CatalogEntry }) {
  if (entry.framework === "soc2") {
    return (
      <dl className="mt-8 space-y-4 text-sm">
        <Row label="Trust Service Criterion" value={entry.tsc} />
        <Row label="Audit period" value={entry.auditPeriod} />
        {entry.pointsOfFocus.length > 0 && (
          <div>
            <dt className="font-medium text-neutral-500">Points of focus</dt>
            <ul className="mt-2 list-disc pl-5 text-neutral-700 dark:text-neutral-300">
              {entry.pointsOfFocus.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </dl>
    );
  }
  if (entry.framework === "gdpr") {
    return (
      <dl className="mt-8 space-y-4 text-sm">
        <Row label="Article" value={entry.article} />
        <Row label="Chapter" value={entry.chapter} />
        {entry.lawfulBasis && entry.lawfulBasis.length > 0 && (
          <Row label="Lawful bases" value={entry.lawfulBasis.join(", ")} />
        )}
        {entry.dataSubjectRight && (
          <Row label="Data subject right" value={entry.dataSubjectRight} />
        )}
      </dl>
    );
  }
  if (entry.framework === "eu-ai-act") {
    return (
      <dl className="mt-8 space-y-4 text-sm">
        <Row label="Article" value={entry.article} />
        <Row label="Risk tier" value={entry.riskTier} />
        {entry.annex && <Row label="Annex" value={entry.annex} />}
      </dl>
    );
  }
  // iso-27001
  return (
    <dl className="mt-8 space-y-4 text-sm">
      <Row label="Annex A reference" value={entry.annexA} />
      <Row label="Domain" value={entry.domain} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-44 shrink-0 font-medium text-neutral-500">{label}</dt>
      <dd className="text-neutral-700 dark:text-neutral-300">{value}</dd>
    </div>
  );
}
