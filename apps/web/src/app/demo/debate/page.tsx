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
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          Triad Review · live debate cockpit
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Counsel, Risk, and Evidence critique your input in parallel. Pick a use case (or paste
          your own). Get one verdict plus where the reviewers agreed and diverged. One Qwen 2.5 72B
          model on a single AMD MI300X. For a no-upload seeded review, try the{" "}
          <Link href="/demo/judge" className="underline-offset-4 hover:underline">
            90-second judge demo
          </Link>
          .
        </p>
      </header>
      <DebateConsole />
    </main>
  );
}
