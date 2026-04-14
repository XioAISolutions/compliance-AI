import fs from "fs/promises";
import path from "path";
import { config, DEFAULT_MATTER_ID, matterPaths } from "../config";
import { authorityWeightFor, type DocType } from "../retrieval-filter";

/**
 * Migration 0001 — stamp pre-matter chunks with matterId/docType fields.
 *
 * Before the consumer-law layer, every chunk lived flat in
 * `compliance-brain/01-corpus/chunks/`. After: chunks carry `matterId`,
 * `docType`, `authorityWeight`, `jurisdiction`. Reads still work without
 * the migration (see `hydrateChunk` in `ingest.ts`) but writes and
 * bookkeeping are cleaner once the files match the new schema.
 *
 * The migration is idempotent: already-stamped chunks are skipped.
 * A `--dry-run` mode emits a plan without touching disk. A real run
 * copies the existing `chunks/` directory to `chunks.backup-<ts>/`
 * before rewriting so nothing is lost.
 */

export interface Migration0001Options {
  dryRun?: boolean;
  /** Override default/target docType for any un-tagged chunk. */
  defaultDocType?: DocType;
  /** If true, also ensure the `default` matter record exists in the matters index. */
  ensureDefaultMatter?: boolean;
}

export interface Migration0001Plan {
  chunkFiles: { path: string; totalChunks: number; toStamp: number }[];
  filesToWrite: number;
  chunksToStamp: number;
  backupPath: string | null;
  defaultMatterRecordWrite: boolean;
}

function stampChunk(raw: Record<string, unknown>, docType: DocType): { changed: boolean; stamped: Record<string, unknown> } {
  const next = { ...raw };
  let changed = false;
  if (typeof next.matterId !== "string" || next.matterId.length === 0) {
    next.matterId = DEFAULT_MATTER_ID;
    changed = true;
  }
  if (typeof next.docType !== "string" || next.docType.length === 0) {
    next.docType = docType;
    changed = true;
  }
  if (typeof next.authorityWeight !== "number") {
    next.authorityWeight = authorityWeightFor(next.docType as DocType);
    changed = true;
  }
  if (typeof next.jurisdiction === "undefined") {
    next.jurisdiction = null;
    changed = true;
  }
  return { changed, stamped: next };
}

async function copyDir(src: string, dst: string) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

export async function runMigration0001(opts: Migration0001Options = {}): Promise<Migration0001Plan> {
  const dryRun = opts.dryRun ?? false;
  const defaultDocType: DocType = opts.defaultDocType ?? "unknown";
  const chunksDir = matterPaths(DEFAULT_MATTER_ID).chunks;

  const plan: Migration0001Plan = {
    chunkFiles: [],
    filesToWrite: 0,
    chunksToStamp: 0,
    backupPath: null,
    defaultMatterRecordWrite: false,
  };

  let files: string[] = [];
  try {
    files = (await fs.readdir(chunksDir)).filter((f) => f.endsWith("-chunks.json"));
  } catch {
    // Corpus hasn't been initialized yet — nothing to migrate.
    return plan;
  }

  // First pass: compute the plan without writing.
  const pending: { file: string; stamped: Record<string, unknown>[] }[] = [];
  for (const file of files) {
    const full = path.join(chunksDir, file);
    const raw = await fs.readFile(full, "utf-8");
    const arr = JSON.parse(raw) as Record<string, unknown>[];
    let fileStamped = 0;
    const stamped = arr.map((rec) => {
      const { changed, stamped } = stampChunk(rec, defaultDocType);
      if (changed) fileStamped += 1;
      return stamped;
    });
    plan.chunkFiles.push({ path: full, totalChunks: arr.length, toStamp: fileStamped });
    plan.chunksToStamp += fileStamped;
    if (fileStamped > 0) {
      plan.filesToWrite += 1;
      pending.push({ file: full, stamped });
    }
  }

  // Default matter record: write on real runs if ensureDefaultMatter is set.
  if (opts.ensureDefaultMatter) {
    const recordPath = matterPaths(DEFAULT_MATTER_ID).record;
    try {
      await fs.access(recordPath);
    } catch {
      plan.defaultMatterRecordWrite = true;
    }
  }

  if (dryRun) return plan;

  if (plan.filesToWrite > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = `${chunksDir}.backup-${ts}`;
    await copyDir(chunksDir, backup);
    plan.backupPath = backup;
    for (const { file, stamped } of pending) {
      await fs.writeFile(file, JSON.stringify(stamped, null, 2));
    }
  }

  if (plan.defaultMatterRecordWrite) {
    const recordPath = matterPaths(DEFAULT_MATTER_ID).record;
    await fs.mkdir(path.dirname(recordPath), { recursive: true });
    const now = new Date().toISOString();
    await fs.writeFile(
      recordPath,
      JSON.stringify(
        {
          id: DEFAULT_MATTER_ID,
          slug: "default",
          displayName: "Default corpus",
          persona: "compliance_ops",
          statuteCorpusIds: [],
          createdAt: now,
          notes: "Pre-existing corpus; stamped by migration 0001.",
        },
        null,
        2,
      ),
    );
  }

  return plan;
}

/**
 * CLI entry: `tsx src/lib/migrations/0001-matters.ts --dry-run`
 */
async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const ensureDefaultMatter = !args.has("--skip-default-matter");
  const plan = await runMigration0001({ dryRun, ensureDefaultMatter });

  const mode = dryRun ? "DRY RUN" : "APPLIED";
  console.log(`Migration 0001 — ${mode}`);
  console.log(`  Chunk files scanned: ${plan.chunkFiles.length}`);
  console.log(`  Files to rewrite:    ${plan.filesToWrite}`);
  console.log(`  Chunks to stamp:     ${plan.chunksToStamp}`);
  if (plan.backupPath) console.log(`  Backup created:      ${plan.backupPath}`);
  if (plan.defaultMatterRecordWrite) console.log(`  Default matter record written.`);
  if (plan.chunksToStamp === 0) console.log(`  Nothing to do — corpus is already stamped.`);
}

// Run if invoked directly (tsx / node --loader).
const invokedDirectly = (() => {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    return entry.endsWith("0001-matters.ts") || entry.endsWith("0001-matters.js");
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
