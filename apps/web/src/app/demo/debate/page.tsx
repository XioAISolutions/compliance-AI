/**
 * Multi-voice debate demo — /demo/debate
 *
 * Click "Run debate" → 3 panels light up in parallel as the skeptical /
 * permissive / regulator voices return from the same LLM endpoint.
 * Designed for the AMD MI300X hackathon: the title bar shows which
 * provider is serving so the demo viewer sees "amd_vllm/Qwen2.5-72B" live.
 */

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
        <h1 className="mt-4 text-3xl font-semibold">Three reviewers, one GPU</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          One Qwen 2.5 72B endpoint, three reviewer stances in parallel. The panel resolves in the
          time of the slowest voice — not the sum.
        </p>
      </header>
      <DebateConsole />
    </main>
  );
}
