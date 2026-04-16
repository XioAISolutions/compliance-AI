import Link from "next/link";
import { QuickReviewDropZone } from "./QuickReviewDropZone";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">XIO Compliance Brain</h1>
        <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
          Private compliance review workbench for lawyers and regulated firms.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Hosted demo uses sample documents. Private installs can run local Ollama.
        </p>
      </div>

      <QuickReviewDropZone />

      <p className="mt-3 text-xs text-neutral-400">
        We&apos;ll detect whether it&apos;s an offering memo, KYC file, marketing deck, or
        regulator letter, and route it to the right reviewer automatically. Hosted
        preview can use OpenAI with sample documents. Private installs can keep
        everything on local Ollama.
      </p>

      <nav className="mt-12 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Link
          href="/demo"
          className="rounded-md bg-neutral-900 px-3 py-2 text-center text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Demo cockpit
        </Link>
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
