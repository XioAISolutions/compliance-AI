import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">compliance-AI</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        AI-native multi-framework compliance — SOC 2, GDPR, EU AI Act, ISO 27001.
      </p>
      <nav className="mt-10 space-y-2">
        <Link
          href="/controls"
          className="inline-block rounded-lg border border-neutral-300 px-4 py-2 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Browse control catalog →
        </Link>
      </nav>
    </main>
  );
}
