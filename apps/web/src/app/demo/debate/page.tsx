import Link from "next/link";
import { DebateConsole } from "./DebateConsole";

export const dynamic = "force-dynamic";

export default function DebateDemoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <Link href="/demo" className="text-sm text-neutral-500 hover:underline">
          ← Demo cockpit
        </Link>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
          Three AI experts. One question. Side by side.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          Most AI tools give you one answer. This one runs <strong>three</strong> at the
          same time — each from a different angle — then summarises where they
          agree, where they disagree, and what to actually do.
        </p>
        <ol className="mt-5 grid gap-4 text-sm leading-relaxed text-neutral-700 sm:grid-cols-3 dark:text-neutral-300">
          <li className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <span className="font-medium text-neutral-900 dark:text-white">1. Pick a use case</span>
            <p className="mt-1 text-xs text-neutral-500">
              Or paste your own — code, contract, OM, business question.
            </p>
          </li>
          <li className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <span className="font-medium text-neutral-900 dark:text-white">2. Three voices critique it</span>
            <p className="mt-1 text-xs text-neutral-500">
              Same Qwen 2.5 72B model, three different stances, all on one AMD MI300X.
            </p>
          </li>
          <li className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <span className="font-medium text-neutral-900 dark:text-white">3. Read the synthesis</span>
            <p className="mt-1 text-xs text-neutral-500">
              We post-process: where voices agreed, where they diverged, and the verdict.
            </p>
          </li>
        </ol>
      </header>
      <DebateConsole />
    </main>
  );
}
