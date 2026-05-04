/**
 * Multi-voice debate demo — /demo/debate
 *
 * Click "Run debate" → 3 panels light up in parallel as the skeptical /
 * permissive / regulator voices return from the same LLM endpoint.
 * Designed for the AMD MI300X hackathon: the title bar shows which
 * provider is serving so the demo viewer sees "amd_vllm/Qwen2.5-72B" live.
 */

import { DebateConsole } from "./DebateConsole";

export const dynamic = "force-dynamic";

export default function DebateDemoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase text-neutral-500">Multi-voice debate</p>
        <h1 className="mt-3 text-4xl font-semibold">Three reviewers, one MI300X</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          The same Qwen 2.5 72B endpoint hosts a skeptical reviewer, a permissive reviewer, and a
          regulator voice in parallel. Each lands its critique independently — the panel resolves in
          roughly the latency of the slowest voice, not the sum. One model, three perspectives, on a
          single AMD MI300X.
        </p>
      </header>
      <DebateConsole />
    </main>
  );
}
