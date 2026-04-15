import { CATALOGS, type FrameworkId } from "@compliance-ai/frameworks";
import Link from "next/link";

const FRAMEWORK_LABEL: Record<FrameworkId, string> = {
  soc2: "SOC 2",
  gdpr: "GDPR",
  "eu-ai-act": "EU AI Act",
  "iso-27001": "ISO 27001",
};

export default function ControlsIndex() {
  const frameworks = Object.entries(CATALOGS) as [FrameworkId, (typeof CATALOGS)[FrameworkId]][];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← home
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Control catalog</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Seed controls across all four supported frameworks. Tenants adopt frameworks at
          onboarding; adoption materializes these entries into their `controls` table.
        </p>
      </header>

      <div className="space-y-10">
        {frameworks.map(([id, entries]) => (
          <section key={id}>
            <h2 className="text-xl font-semibold">
              {FRAMEWORK_LABEL[id]}
              <span className="ml-2 text-sm font-normal text-neutral-500">
                {entries.length} control{entries.length === 1 ? "" : "s"}
              </span>
            </h2>
            <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {entries.map((e) => (
                <li key={e.slug}>
                  <Link
                    href={`/controls/${encodeURIComponent(e.slug)}`}
                    className="block p-4 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <div className="flex items-baseline gap-3">
                      <code className="text-sm text-neutral-500">{e.code}</code>
                      <span className="font-medium">{e.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {e.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
