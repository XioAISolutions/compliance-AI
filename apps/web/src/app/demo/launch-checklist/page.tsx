import Link from "next/link";

const checklist = [
  {
    title: "Demo opens cleanly",
    items: ["Start web app", "Open /demo", "Confirm command center renders without API keys"],
  },
  {
    title: "Buyer story works",
    items: [
      "Show readiness score",
      "Open prioritized risk queue",
      "Open evidence pack",
      "Open one control workspace",
      "Use existing chat panel and judge loop",
    ],
  },
  {
    title: "Protection guardrails",
    items: [
      "No repo cross-dependency added",
      "No database migration required for demo",
      "No QPanda runtime dependency required for demo",
      "Safe disclaimer visible in command center",
    ],
  },
  {
    title: "Next production layer",
    items: [
      "Persist assessment runs to Drizzle tables",
      "Swap in pgvector cognition backend",
      "Add file upload/import for policy and evidence artifacts",
      "Add optional QPanda optimizer sidecar behind the existing scoring contract",
    ],
  },
];

export default function LaunchChecklistPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-8">
        <Link href="/demo" className="text-sm text-neutral-500 hover:underline">
          ← demo command center
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Launch checklist</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Use this to run the product demo without breaking the current scaffold.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {checklist.map((section) => (
          <section key={section.title} className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-0.5 text-neutral-400">□</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
