"use client";

/**
 * Onboarding — first-login flow.
 *
 * Collects the org name + jurisdiction default. POSTs to
 * `/api/onboarding/complete` which creates an organization row, links the
 * current user, and seeds the tenant's authority corpus.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

const JURISDICTIONS = [
  { value: "ontario", label: "Ontario" },
  { value: "quebec", label: "Quebec" },
  { value: "british-columbia", label: "British Columbia" },
  { value: "alberta", label: "Alberta" },
  { value: "saskatchewan", label: "Saskatchewan" },
  { value: "manitoba", label: "Manitoba" },
  { value: "nova-scotia", label: "Nova Scotia" },
  { value: "new-brunswick", label: "New Brunswick" },
  { value: "newfoundland", label: "Newfoundland & Labrador" },
  { value: "pei", label: "Prince Edward Island" },
  { value: "northwest-territories", label: "Northwest Territories" },
  { value: "yukon", label: "Yukon" },
  { value: "nunavut", label: "Nunavut" },
  { value: "federal", label: "Federal" },
  { value: "multi-provincial", label: "Multi-provincial" },
];

const REGISTRATION_CATEGORIES = [
  { value: "emd", label: "Exempt Market Dealer" },
  { value: "pm", label: "Portfolio Manager" },
  { value: "iiroc", label: "IIROC Dealer (CIRO)" },
  { value: "issuer", label: "Reporting Issuer" },
  { value: "none", label: "None / Outside Counsel" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("ontario");
  const [registrationCategory, setRegistrationCategory] = useState("emd");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, jurisdiction, registrationCategory }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Sign-up failed: ${res.status}`);
        return;
      }
      router.push("/matters");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to XIO</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Set up your organization to start reviewing. This takes about 30 seconds.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Organization name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Acme Capital Inc."
            className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700"
          />
        </div>

        <div>
          <label htmlFor="jurisdiction" className="block text-sm font-medium">
            Primary jurisdiction
          </label>
          <select
            id="jurisdiction"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          >
            {JURISDICTIONS.map((j) => (
              <option key={j.value} value={j.value}>
                {j.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-neutral-500">
            Controls which regulatory authorities pre-load into matter context.
          </p>
        </div>

        <div>
          <label htmlFor="registration" className="block text-sm font-medium">
            Registration category
          </label>
          <select
            id="registration"
            value={registrationCategory}
            onChange={(e) => setRegistrationCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          >
            {REGISTRATION_CATEGORIES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "Creating…" : "Create organization"}
        </button>
      </form>
    </main>
  );
}
