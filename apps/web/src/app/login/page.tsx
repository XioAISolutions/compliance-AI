"use client";

/**
 * Login — email credentials + optional OAuth. Only routes hit this page
 * when auth is configured (middleware redirects here on 401).
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/matters";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email,
          callbackUrl,
          redirect: "false",
          csrfToken: await fetchCsrfToken(),
        }).toString(),
      });
      if (res.ok || res.redirected) {
        window.location.href = callbackUrl;
      } else {
        setError("Sign-in failed. Check the email and try again.");
      }
    } catch {
      setError("Sign-in error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-500">
        XIO Compliance Brain
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700"
          />
        </div>
        {error && (
          <p className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Signing in…" : "Continue"}
        </button>
      </form>

      <p className="mt-8 text-center text-[10px] text-neutral-400">
        Hosted preview uses sample documents. Private installs can run local Ollama.
      </p>
    </main>
  );
}

async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/csrf");
    if (res.ok) {
      const data = (await res.json()) as { csrfToken?: string };
      return data.csrfToken ?? "";
    }
  } catch {
    // ignore
  }
  return "";
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
