import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      <p className="font-mono text-xs text-neutral-400">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-neutral-500">
        The URL you followed either moved or never existed.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link
          href="/"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Home
        </Link>
        <Link
          href="/matters"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Open matters
        </Link>
      </div>
    </main>
  );
}
