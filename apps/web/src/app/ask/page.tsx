/**
 * /ask — question-driven compliance Q&A surface.
 *
 * Unlike /matters/[id] (task-driven, anchored to an uploaded document and
 * a judge loop) or /controls/[slug] (infosec catalog chat), this page is
 * a single-shot Q&A surface. You type a question, pick one or more
 * jurisdictions, and get back a cited answer with a plain-language
 * summary, professional analysis, and — when jurisdictions disagree — a
 * cross-jurisdiction note.
 *
 * The whole form + stream consumer lives in AskForm.tsx (client
 * component); this server shell is just the page frame and static copy.
 */

import Link from "next/link";
import { AskForm } from "./AskForm";

export const metadata = {
  title: "Ask — XIO Compliance Brain",
  description:
    "Ask a compliance question and get a cited answer grounded in Canadian and US securities authorities.",
};

export default function AskPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav className="mb-6 text-sm text-neutral-500">
        <Link href="/" className="hover:text-neutral-700 dark:hover:text-neutral-300">
          ← Home
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Ask the compliance brain</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Ask a question about securities or compliance regulation. The answer is drawn from
          publicly available Canadian (NI 45-106, NI 45-102, NI 31-103) and US (Regulation D, Rule
          144, Securities Act) authorities, with citations back to each section.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Not legal advice. For specific transactions, consult qualified counsel.
        </p>
      </header>

      <AskForm />
    </main>
  );
}
