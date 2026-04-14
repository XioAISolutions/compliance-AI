import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { config, DEFAULT_MATTER_ID, matterPaths } from "./config";

/**
 * Matter registry.
 *
 * Every consumer-law workflow (client case, complaint response, contract
 * review, triage session) is a matter. Matters own their own documents,
 * intake, drafts, audit log, and graph — the vector store is one map
 * in memory but every chunk is tagged with its matter id and retrieval
 * filters prevent cross-matter leakage.
 *
 * Shared statute libraries (e.g. `lib-fdcpa`) are modeled as regular
 * matters with a `lib-` id prefix so they can be referenced by any
 * working matter via `statuteCorpusIds` without duplicating vectors.
 */

export type MatterPersona = "plaintiff" | "compliance_ops" | "legal_aid" | "in_house";

export interface Matter {
  id: string;
  slug: string;              // URL-safe, human-readable
  displayName: string;
  persona: MatterPersona;
  jurisdiction?: string;
  /** Matter ids (typically `lib-*`) to include when retrieving statutes for this matter. */
  statuteCorpusIds: string[];
  createdAt: string;
  notes?: string;
  /** True when this matter is a shared statute library. */
  isLibrary?: boolean;
}

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "matter";
}

async function readIndex(): Promise<Matter[]> {
  try {
    const raw = await fs.readFile(config.paths.mattersIndex, "utf-8");
    const arr = JSON.parse(raw) as Matter[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeIndex(matters: Matter[]): Promise<void> {
  await fs.mkdir(path.dirname(config.paths.mattersIndex), { recursive: true });
  await fs.writeFile(config.paths.mattersIndex, JSON.stringify(matters, null, 2));
}

/**
 * Ensure the canonical `default` matter record exists. We create it lazily
 * so an install that only ever uses the legacy global corpus still has a
 * matter object to reference.
 */
async function ensureDefaultMatter(index: Matter[]): Promise<Matter[]> {
  if (index.some((m) => m.id === DEFAULT_MATTER_ID)) return index;
  const now = new Date().toISOString();
  const defaultMatter: Matter = {
    id: DEFAULT_MATTER_ID,
    slug: "default",
    displayName: "Default corpus",
    persona: "compliance_ops",
    statuteCorpusIds: [],
    createdAt: now,
    notes: "Pre-existing corpus from before the consumer-law layer was introduced.",
  };
  const next = [defaultMatter, ...index];
  await writeIndex(next);
  // Also ensure the sidecar directory exists so triage/drafts/audit can land.
  const paths = matterPaths(DEFAULT_MATTER_ID);
  await fs.mkdir(path.dirname(paths.record), { recursive: true });
  try {
    await fs.access(paths.record);
  } catch {
    await fs.writeFile(paths.record, JSON.stringify(defaultMatter, null, 2));
  }
  return next;
}

export async function listMatters(): Promise<Matter[]> {
  const index = await ensureDefaultMatter(await readIndex());
  return index;
}

export async function getMatter(id: string): Promise<Matter | null> {
  const matters = await listMatters();
  return matters.find((m) => m.id === id) ?? null;
}

export interface CreateMatterInput {
  displayName: string;
  persona: MatterPersona;
  jurisdiction?: string;
  statuteCorpusIds?: string[];
  notes?: string;
  isLibrary?: boolean;
}

export async function createMatter(input: CreateMatterInput): Promise<Matter> {
  if (!input.displayName?.trim()) throw new Error("displayName is required");
  const index = await listMatters();
  const baseSlug = slugify(input.displayName);
  let slug = baseSlug, n = 1;
  while (index.some((m) => m.slug === slug)) slug = `${baseSlug}-${++n}`;

  const matter: Matter = {
    id: input.isLibrary ? `lib-${slug}` : uuid(),
    slug,
    displayName: input.displayName.trim(),
    persona: input.persona,
    jurisdiction: input.jurisdiction,
    statuteCorpusIds: input.statuteCorpusIds ?? [],
    createdAt: new Date().toISOString(),
    notes: input.notes,
    isLibrary: input.isLibrary,
  };

  await writeIndex([matter, ...index]);

  const paths = matterPaths(matter.id);
  await fs.mkdir(paths.root, { recursive: true });
  await fs.mkdir(paths.raw, { recursive: true });
  await fs.mkdir(paths.chunks, { recursive: true });
  await fs.mkdir(paths.vectors, { recursive: true });
  await fs.mkdir(paths.intake, { recursive: true });
  await fs.mkdir(paths.drafts, { recursive: true });
  await fs.mkdir(paths.audit, { recursive: true });
  await fs.mkdir(paths.graph, { recursive: true });
  await fs.writeFile(paths.record, JSON.stringify(matter, null, 2));

  return matter;
}

export async function updateMatter(id: string, patch: Partial<CreateMatterInput>): Promise<Matter> {
  const index = await listMatters();
  const existing = index.find((m) => m.id === id);
  if (!existing) throw new Error(`Matter not found: ${id}`);
  const updated: Matter = {
    ...existing,
    displayName: patch.displayName?.trim() || existing.displayName,
    persona: patch.persona ?? existing.persona,
    jurisdiction: patch.jurisdiction ?? existing.jurisdiction,
    statuteCorpusIds: patch.statuteCorpusIds ?? existing.statuteCorpusIds,
    notes: patch.notes ?? existing.notes,
  };
  const next = index.map((m) => (m.id === id ? updated : m));
  await writeIndex(next);
  const paths = matterPaths(id);
  await fs.mkdir(path.dirname(paths.record), { recursive: true });
  await fs.writeFile(paths.record, JSON.stringify(updated, null, 2));
  return updated;
}

/**
 * Resolve the effective retrieval scope for a matter: the matter itself
 * plus any statute libraries it subscribes to. Used by retrieval callers
 * that want "everything this matter should see".
 */
export async function effectiveMatterIds(id: string): Promise<string[]> {
  const m = await getMatter(id);
  if (!m) return [id];
  return [m.id, ...m.statuteCorpusIds];
}
