import Link from "next/link";
import { QuickReviewDropZone } from "./QuickReviewDropZone";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-4xl font-semibold tracking-tight">XIO Compliance Brain</h1>
      <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
        Drop a document. Get a citation-backed review.
      </p>

      {/* The hero action: one drag, one drop, one review. */}
      <div className="mt-8">
        <QuickReviewDropZone />
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        We&apos;ll detect whether it&apos;s an offering memo, KYC file, marketing deck, or
        regulator letter, and route it to the right reviewer automatically. Cloud
        inference via Anthropic with enterprise zero-retention on your documents.
      </p>

      {/* Secondary entry points — smaller, visually demoted. */}
      <nav className="mt-12 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Link
          href="/queue"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Today&apos;s queue
        </Link>
        <Link
          href="/matters"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          All matters
        </Link>
        <Link
          href="/approvals"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Approvals
        </Link>
        <Link
          href="/controls"
          className="rounded-md border border-neutral-200 px-3 py-2 text-center text-neutral-500 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          Infosec catalog
        </Link>
      </nav>
    </main>
  );
}
