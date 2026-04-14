import fs from "fs/promises";
import path from "path";
import { query } from "../citation-engine";
import type { Strategy } from "../retrieval-strategies";
import { vectorStore } from "../vector-store";
import { config } from "../config";

/**
 * Evaluation harness.
 *
 * Walks `compliance-brain/03-eval/test-questions.md`, runs every question
 * through each retrieval strategy, and writes a structured run file plus
 * a markdown summary under `compliance-brain/03-eval/runs/`.
 *
 * Intended use:
 *   npm run eval                     # all strategies
 *   npm run eval -- --strategy=hyde  # single strategy
 *   npm run eval -- --limit=3        # first N questions only
 *
 * The script is intentionally self-contained — no test framework, no
 * network assertions. It captures per-question timings, citation counts,
 * verification rates, and the first line of the answer so we can eyeball
 * regressions between runs.
 */

type Args = { strategies: Strategy[]; limit: number | null };

const ALL_STRATEGIES: Strategy[] = ["hybrid", "hyde", "multi"];

function parseArgs(argv: string[]): Args {
  let strategies: Strategy[] = [...ALL_STRATEGIES];
  let limit: number | null = null;
  for (const a of argv) {
    if (a.startsWith("--strategy=")) {
      const s = a.slice("--strategy=".length) as Strategy;
      if (!ALL_STRATEGIES.includes(s)) {
        throw new Error(`Unknown strategy: ${s}. Valid: ${ALL_STRATEGIES.join(", ")}`);
      }
      strategies = [s];
    } else if (a.startsWith("--limit=")) {
      const n = parseInt(a.slice("--limit=".length), 10);
      if (Number.isNaN(n) || n <= 0) throw new Error(`Invalid --limit: ${a}`);
      limit = n;
    }
  }
  return { strategies, limit };
}

async function loadQuestions(): Promise<string[]> {
  const p = path.resolve("./compliance-brain/03-eval/test-questions.md");
  const raw = await fs.readFile(p, "utf-8");
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^\d+\.\s+/, "").trim())
    .filter(Boolean);
}

interface PerRun {
  strategy: Strategy;
  question: string;
  answerFirstLine: string;
  answerLength: number;
  citationCount: number;
  verifiedCount: number;
  avgOverlap: number;
  topFused: number | null;
  queryTimeMs: number;
  model: string;
  error?: string;
}

async function runOne(question: string, strategy: Strategy): Promise<PerRun> {
  const startedAt = Date.now();
  try {
    const r = await query(question, { strategy });
    const firstLine = r.answer.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
    const overlaps = r.citations.map((c) => c.verification.overlap);
    const avgOverlap = overlaps.length ? overlaps.reduce((a, b) => a + b, 0) / overlaps.length : 0;
    return {
      strategy,
      question,
      answerFirstLine: firstLine.slice(0, 160),
      answerLength: r.answer.length,
      citationCount: r.citations.length,
      verifiedCount: r.citations.filter((c) => c.verification.verified).length,
      avgOverlap: Number(avgOverlap.toFixed(3)),
      topFused: r.retrievedChunks.length > 0 ? Number((r.citations[0]?.confidence ?? 0).toFixed(4)) : null,
      queryTimeMs: r.queryTimeMs,
      model: r.model,
    };
  } catch (err: any) {
    return {
      strategy,
      question,
      answerFirstLine: "",
      answerLength: 0,
      citationCount: 0,
      verifiedCount: 0,
      avgOverlap: 0,
      topFused: null,
      queryTimeMs: Date.now() - startedAt,
      model: config.ollama.chatModel,
      error: err?.message ?? String(err),
    };
  }
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n - 1) + "…";
  return s + " ".repeat(n - s.length);
}

function printTable(rows: PerRun[]) {
  const header = [pad("strategy", 9), pad("ms", 7), pad("cits", 5), pad("ver", 5), pad("olap", 6), pad("question", 48)].join(" | ");
  console.log("\n" + header);
  console.log("-".repeat(header.length));
  for (const r of rows) {
    console.log([
      pad(r.strategy, 9),
      pad(String(r.queryTimeMs), 7),
      pad(String(r.citationCount), 5),
      pad(String(r.verifiedCount), 5),
      pad(r.avgOverlap.toFixed(2), 6),
      pad(r.question, 48),
    ].join(" | "));
  }
}

function summarize(rows: PerRun[]): Record<Strategy, { n: number; avgMs: number; avgCits: number; avgVerified: number; avgOverlap: number; errors: number }> {
  const out: any = {};
  for (const s of ALL_STRATEGIES) {
    const subset = rows.filter((r) => r.strategy === s);
    if (subset.length === 0) continue;
    out[s] = {
      n: subset.length,
      avgMs: Math.round(subset.reduce((a, r) => a + r.queryTimeMs, 0) / subset.length),
      avgCits: Number((subset.reduce((a, r) => a + r.citationCount, 0) / subset.length).toFixed(2)),
      avgVerified: Number((subset.reduce((a, r) => a + r.verifiedCount, 0) / subset.length).toFixed(2)),
      avgOverlap: Number((subset.reduce((a, r) => a + r.avgOverlap, 0) / subset.length).toFixed(3)),
      errors: subset.filter((r) => r.error).length,
    };
  }
  return out;
}

function markdownSummary(rows: PerRun[], meta: { timestamp: string; totalQuestions: number; totalRuns: number }): string {
  const lines: string[] = [];
  lines.push(`# Eval run — ${meta.timestamp}`);
  lines.push("");
  lines.push(`- Questions: ${meta.totalQuestions}`);
  lines.push(`- Total invocations: ${meta.totalRuns}`);
  lines.push("");
  lines.push(`## Per-strategy averages`);
  lines.push("");
  lines.push(`| strategy | n | avg ms | avg cits | avg verified | avg overlap | errors |`);
  lines.push(`|----------|---|--------|----------|--------------|-------------|--------|`);
  const summary = summarize(rows);
  for (const [s, v] of Object.entries(summary)) {
    lines.push(`| ${s} | ${v.n} | ${v.avgMs} | ${v.avgCits} | ${v.avgVerified} | ${v.avgOverlap} | ${v.errors} |`);
  }
  lines.push("");
  lines.push(`## Per-question details`);
  for (const r of rows) {
    lines.push("");
    lines.push(`### [${r.strategy}] ${r.question}`);
    if (r.error) {
      lines.push(`- **error:** ${r.error}`);
      continue;
    }
    lines.push(`- ${r.queryTimeMs}ms · ${r.citationCount} citations (${r.verifiedCount} verified) · avg overlap ${r.avgOverlap}`);
    lines.push(`- first line: ${r.answerFirstLine || "(empty)"}`);
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await vectorStore.refresh();
  const corpusSize = await vectorStore.count();
  if (corpusSize === 0) {
    console.error("No embeddings found. Run `npm run ingest` with PDFs in compliance-brain/01-corpus/raw/ first.");
    process.exit(1);
  }

  const allQuestions = await loadQuestions();
  const questions = args.limit ? allQuestions.slice(0, args.limit) : allQuestions;
  if (questions.length === 0) {
    console.error("No questions found in compliance-brain/03-eval/test-questions.md");
    process.exit(1);
  }

  console.log(`\nCorpus: ${corpusSize} chunks · Strategies: ${args.strategies.join(", ")} · Questions: ${questions.length}\n`);

  const rows: PerRun[] = [];
  for (const q of questions) {
    for (const strategy of args.strategies) {
      process.stdout.write(`  [${strategy}] ${q.slice(0, 60)}... `);
      const row = await runOne(q, strategy);
      rows.push(row);
      process.stdout.write(row.error ? `ERROR (${row.error})\n` : `${row.queryTimeMs}ms, ${row.citationCount} cits (${row.verifiedCount} verified)\n`);
    }
  }

  printTable(rows);
  console.log("\nPer-strategy averages:", summarize(rows));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runsDir = path.resolve("./compliance-brain/03-eval/runs");
  await fs.mkdir(runsDir, { recursive: true });
  const jsonPath = path.join(runsDir, `run-${timestamp}.json`);
  const mdPath = path.join(runsDir, `run-${timestamp}.md`);
  const payload = {
    timestamp,
    corpusSize,
    strategies: args.strategies,
    totalQuestions: questions.length,
    totalRuns: rows.length,
    model: config.ollama.chatModel,
    summary: summarize(rows),
    rows,
  };
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2));
  await fs.writeFile(mdPath, markdownSummary(rows, { timestamp, totalQuestions: questions.length, totalRuns: rows.length }));
  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
