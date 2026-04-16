"use client";

/**
 * Global error boundary — catches any uncaught render/runtime error in
 * the app, shows the user something honest, and exposes a reset button
 * so they can retry without a full page reload.
 *
 * Production (Railway) uses Next.js's default digest redaction — the
 * full error message lives in the server logs, never the UI. The digest
 * we do surface is safe to show + useful for customer-support triage.
 */

import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    // Best-effort console log so local dev can see the full stack.
    if (process.env.NODE_ENV === "development") {

      console.error("[compliance-ai] Unhandled render error:", error);
    }
  }, [error]);

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-red-600 dark:text-red-400">
        Something broke.
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        We hit an unhandled error while rendering this page. The full stack
        is in the server log; what you see here is the redacted version.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-xs text-neutral-400">
          digest: {error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <button
          onClick={reset}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Retry
        </button>
        <a
          href="/"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Home
        </a>
      </div>
    </main>
  );
}
