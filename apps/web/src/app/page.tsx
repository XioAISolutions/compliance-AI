import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">
        XIO Compliance Brain
      </h1>
      <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
        Citation-first securities compliance workbench.
      </p>
      <p className="mt-2 text-sm text-neutral-500">
        Review offering memoranda, run KYC gap checks, sign off on marketing materials,
        and draft response memos — with structured citations back to the source rules.
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        Cloud inference via Anthropic with enterprise zero-retention on your documents.
      </p>

      <nav className="mt-10 space-y-3">
        <Link
          href="/queue"
          className="flex items-center gap-3 rounded-lg border border-neutral-300 px-5 py-3 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-600 text-xs font-bold text-white">
            Q
          </span>
          <div>
            <span className="text-sm font-medium">Today&apos;s queue</span>
            <p className="text-xs text-neutral-500">
              Prioritized matters — what needs attention now
            </p>
          </div>
        </Link>
        <Link
          href="/matters"
          className="flex items-center gap-3 rounded-lg border border-neutral-300 px-5 py-3 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-xs font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
            OM
          </span>
          <div>
            <span className="text-sm font-medium">Open matters</span>
            <p className="text-xs text-neutral-500">
              Create or continue a securities compliance review
            </p>
          </div>
        </Link>
        <Link
          href="/approvals"
          className="flex items-center gap-3 rounded-lg border border-neutral-300 px-5 py-3 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-green-600 text-xs font-bold text-white">
            ✓
          </span>
          <div>
            <span className="text-sm font-medium">Approvals queue</span>
            <p className="text-xs text-neutral-500">
              CCO sign-off on READY_TO_SUBMIT reviews
            </p>
          </div>
        </Link>
        <Link
          href="/controls"
          className="flex items-center gap-3 rounded-lg border border-neutral-200 px-5 py-3 text-neutral-400 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100 text-xs font-bold text-neutral-400 dark:bg-neutral-900">
            GRC
          </span>
          <div>
            <span className="text-sm font-medium">Infosec control catalog</span>
            <p className="text-xs text-neutral-400">
              SOC 2, GDPR, EU AI Act, ISO 27001 — separate surface
            </p>
          </div>
        </Link>
      </nav>
    </main>
  );
}
