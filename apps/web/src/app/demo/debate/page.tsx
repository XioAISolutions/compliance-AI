import Link from "next/link";
import { DebateConsole } from "./DebateConsole";

export const dynamic = "force-dynamic";

export default function DebateDemoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-6 sm:py-8">
      <header className="mb-5">
        <Link href="/demo" className="text-sm text-neutral-500 hover:underline">
          ← Demo cockpit
        </Link>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Optional live Triad debate</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          This is the live inference surface. Counsel, Risk, and Evidence critique an input in
          parallel on one Qwen 2.5 72B model running behind the AMD MI300X endpoint. Judges should
          start with the{" "}
          <Link href="/demo/judge" className="underline-offset-4 hover:underline">
            90-second judge demo
          </Link>{" "}
          first; use this page only when you want to see the GPU-backed run.
        </p>
      </header>
      <DebateConsole />
    </main>
  );
}
