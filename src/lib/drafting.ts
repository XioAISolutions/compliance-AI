import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { matterPaths } from "./config";
import { query, type CitedAnswer } from "./citation-engine";
import { getMatter, effectiveMatterIds, type Matter } from "./matters";
import { loadIntake, summarizeIntake, type Intake } from "./intake";
import type { RetrievalFilter, DocType } from "./retrieval-filter";
import type { PromptProfileId } from "./prompt-profiles";
import type { Citation } from "./citation-engine";

/**
 * Drafting.
 *
 * A draft is a kind-specific sequence of sections (DraftSection) each with
 * a heading, per-section guidance for the LLM, and the docTypes the
 * section should be grounded in. `generateDraft` retrieves per section,
 * calls the citation engine with the matching prompt profile, runs the
 * result through the standard verify+judge path (already baked into
 * `query()`), and accumulates the pieces into a `Draft` object.
 *
 * Readiness: a draft is "sign-ready" when every section's citations
 * resolve (zero invalidTags surfaced by the engine) and — when the judge
 * is on — the judge-supported ratio clears a configurable floor. The
 * UI turns this into a pill per draft.
 *
 * MVP ships `demand_letter` only. Additional kinds (complaint,
 * internal_memo, response_to_regulator) slot into `DRAFT_TEMPLATES`.
 */

export type DraftKind = "demand_letter" | "complaint" | "internal_memo" | "response_to_regulator";

export interface DraftSectionTemplate {
  id: string;
  heading: string;
  /** Per-section instruction the LLM sees alongside SOURCES. */
  guidance: string;
  /** docTypes the retrieval filter is scoped to for this section. */
  requiredCitations: DocType[];
  /** Optional retrieval topK override for this section. */
  topK?: number;
}

export interface DraftTemplate {
  kind: DraftKind;
  displayName: string;
  /** Prompt profile used by every section of this kind. */
  promptProfile: PromptProfileId;
  sections: DraftSectionTemplate[];
}

export interface DraftSection extends DraftSectionTemplate {
  answer: string;
  citations: Citation[];
  invalidTagCount: number;
  verifiedRate: number;
  judgeSupportedRate: number | null;
}

export interface Draft {
  id: string;
  matterId: string;
  kind: DraftKind;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  sections: DraftSection[];
  readiness: {
    signReady: boolean;
    verifiedRate: number;
    judgeSupportedRate: number | null;
    totalCitations: number;
    totalInvalidTags: number;
  };
}

// --- Templates -------------------------------------------------------------

const DEMAND_LETTER: DraftTemplate = {
  kind: "demand_letter",
  displayName: "Demand letter",
  promptProfile: "plaintiff_demand",
  sections: [
    {
      id: "opening",
      heading: "Opening",
      guidance:
        "Write the opening paragraph of a plaintiff demand letter. Identify the parties by the names in the intake, state that this letter is a demand arising from the conduct described, and summarize the core grievance in one or two sentences. Cite one or two client-facts or correspondence chunks that anchor the grievance. Do not cite statutes yet.",
      requiredCitations: ["client_facts", "correspondence"],
    },
    {
      id: "facts",
      heading: "Statement of facts",
      guidance:
        "Produce a chronological statement of facts drawn ONLY from the sources. Each fact must end with a citation to the supporting client-facts or correspondence chunk. Do not editorialize; keep the tone direct and specific. If a critical fact appears absent from the sources, emit [[NEEDED: <fact>]] inline.",
      requiredCitations: ["client_facts", "correspondence", "contract"],
      topK: 8,
    },
    {
      id: "legal-basis",
      heading: "Legal basis",
      guidance:
        "Identify each statute or regulation the conduct appears to violate. For each, quote or paraphrase the binding language, cite it, and enumerate the statutory elements. Every element statement must cite the statute/regulation source. Use plain English where possible but never invent statutory text.",
      requiredCitations: ["statute", "regulation"],
      topK: 8,
    },
    {
      id: "application",
      heading: "Application to facts",
      guidance:
        "For each statutory element identified in the Legal Basis section, name the element and cite a specific fact from the client-facts/correspondence sources that satisfies it. If the sources do not contain a satisfying fact for an element, emit [[NEEDED: <what is missing>]] rather than glossing over it.",
      requiredCitations: ["client_facts", "correspondence", "contract", "statute", "regulation"],
      topK: 10,
    },
    {
      id: "demands",
      heading: "Demands and remedy",
      guidance:
        "State the concrete relief sought. If a statute specifies available damages or remedies, cite the statute for that amount or remedy. Do not invent dollar figures; if quantum is not grounded in sources, emit [[NEEDED: damages figure]] and continue.",
      requiredCitations: ["statute", "regulation", "client_facts"],
    },
    {
      id: "closing",
      heading: "Closing",
      guidance:
        "Write a closing paragraph with a deadline for response and notice that failure to resolve may result in litigation. This section does not require citations; keep it brief and professional.",
      requiredCitations: [],
    },
  ],
};

export const DRAFT_TEMPLATES: Record<DraftKind, DraftTemplate | null> = {
  demand_letter: DEMAND_LETTER,
  // MVP ships demand_letter only. Phase 2 fills these in.
  complaint: null,
  internal_memo: null,
  response_to_regulator: null,
};

export function getDraftTemplate(kind: DraftKind): DraftTemplate {
  const t = DRAFT_TEMPLATES[kind];
  if (!t) throw new Error(`Draft kind '${kind}' is not available in this build`);
  return t;
}

// --- Generation ------------------------------------------------------------

function buildSectionQuestion(
  template: DraftSectionTemplate,
  matter: Matter,
  intake: Intake | null,
): string {
  const parts: string[] = [];
  parts.push(`You are drafting the "${template.heading}" section of a ${matter.displayName} demand letter.`);
  parts.push("");
  parts.push("MATTER CONTEXT:");
  parts.push(`  Persona: ${matter.persona}`);
  if (matter.jurisdiction) parts.push(`  Jurisdiction: ${matter.jurisdiction}`);
  if (intake) {
    const summary = summarizeIntake(intake).trim();
    if (summary) {
      parts.push("");
      parts.push("INTAKE:");
      parts.push(summary);
    }
  }
  parts.push("");
  parts.push("SECTION GUIDANCE:");
  parts.push(template.guidance);
  return parts.join("\n");
}

function summarizeSection(answer: CitedAnswer): Omit<DraftSection, keyof DraftSectionTemplate> {
  const totalCitations = answer.citations.length;
  const verified = answer.citations.filter((c) => c.verification.verified).length;
  const judged = answer.citations.filter((c) => c.judge).length;
  const judgeSupported = answer.citations.filter((c) => c.judge?.supported).length;

  // `extractAndValidateCitations` already strips invalid tags from the
  // answer string, so invalidTagCount is the residual count of refs the
  // LLM emitted that didn't match any SOURCE. We recompute from the final
  // answer against the resolved citations as a sanity check.
  const refPattern = /\[\[\s*S\d+\s*:\s*[^\]]+?\s*\]\]/gi;
  const emittedRefs = [...answer.answer.matchAll(refPattern)];
  const invalidTagCount = Math.max(0, emittedRefs.length - totalCitations);

  return {
    answer: answer.answer,
    citations: answer.citations,
    invalidTagCount,
    verifiedRate: totalCitations > 0 ? verified / totalCitations : 1,
    judgeSupportedRate: judged > 0 ? judgeSupported / judged : null,
  };
}

export interface GenerateDraftOptions {
  /** When true (or "weak"), runs the LLM judge during each section's query(). */
  judge?: boolean | "weak";
  /** Minimum verified rate for the draft as a whole to be considered sign-ready. */
  verifiedFloor?: number;
  /** Minimum judge-supported rate when judge is on. Ignored when judge is off. */
  judgeFloor?: number;
  /** Per-section retrieval filter additions (e.g. jurisdiction override). */
  filterOverrides?: Partial<RetrievalFilter>;
  /** Yield a progress event after each section is generated. */
  onSectionDone?: (section: DraftSection, index: number, total: number) => void;
}

/**
 * Generate a draft synchronously. Streaming UI is a future layer; at
 * MVP we render the draft sections one-by-one and display a spinner.
 */
export async function generateDraft(
  matterId: string,
  kind: DraftKind,
  opts: GenerateDraftOptions = {},
): Promise<Draft> {
  const matter = await getMatter(matterId);
  if (!matter) throw new Error(`Matter not found: ${matterId}`);
  const template = getDraftTemplate(kind);
  const intake = await loadIntake(matterId);
  const matterIds = await effectiveMatterIds(matterId);

  const sections: DraftSection[] = [];
  for (let i = 0; i < template.sections.length; i++) {
    const sec = template.sections[i];
    const filter: RetrievalFilter = {
      ...opts.filterOverrides,
      matterIds,
      docTypes: sec.requiredCitations.length > 0 ? sec.requiredCitations : opts.filterOverrides?.docTypes,
    };
    const question = buildSectionQuestion(sec, matter, intake);
    const answer = await query(question, {
      filter,
      topK: sec.topK,
      judge: opts.judge,
      promptProfile: template.promptProfile,
    });
    const finalSection: DraftSection = { ...sec, ...summarizeSection(answer) };
    sections.push(finalSection);
    opts.onSectionDone?.(finalSection, i, template.sections.length);
  }

  const totalCitations = sections.reduce((n, s) => n + s.citations.length, 0);
  const totalVerified = sections.reduce(
    (n, s) => n + s.citations.filter((c) => c.verification.verified).length,
    0,
  );
  const totalJudged = sections.reduce((n, s) => n + s.citations.filter((c) => c.judge).length, 0);
  const totalJudgeSupported = sections.reduce(
    (n, s) => n + s.citations.filter((c) => c.judge?.supported).length,
    0,
  );
  const totalInvalidTags = sections.reduce((n, s) => n + s.invalidTagCount, 0);
  const verifiedRate = totalCitations > 0 ? totalVerified / totalCitations : 1;
  const judgeSupportedRate = totalJudged > 0 ? totalJudgeSupported / totalJudged : null;

  const verifiedFloor = opts.verifiedFloor ?? 0.6;
  const judgeFloor = opts.judgeFloor ?? 0.6;
  const signReady =
    totalInvalidTags === 0 &&
    verifiedRate >= verifiedFloor &&
    (judgeSupportedRate === null || judgeSupportedRate >= judgeFloor);

  const now = new Date().toISOString();
  return {
    id: uuid(),
    matterId,
    kind,
    displayName: template.displayName,
    createdAt: now,
    updatedAt: now,
    sections,
    readiness: {
      signReady,
      verifiedRate,
      judgeSupportedRate,
      totalCitations,
      totalInvalidTags,
    },
  };
}

// --- Persistence + export --------------------------------------------------

const DRAFTS_FILE_EXT = ".json";

export async function saveDraft(draft: Draft): Promise<void> {
  const dir = matterPaths(draft.matterId).drafts;
  await fs.mkdir(dir, { recursive: true });
  draft.updatedAt = new Date().toISOString();
  await fs.writeFile(path.join(dir, `${draft.id}${DRAFTS_FILE_EXT}`), JSON.stringify(draft, null, 2));
}

export async function listDrafts(matterId: string): Promise<Draft[]> {
  const dir = matterPaths(matterId).drafts;
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(DRAFTS_FILE_EXT));
    const out: Draft[] = [];
    for (const f of files) {
      try {
        const raw = await fs.readFile(path.join(dir, f), "utf-8");
        out.push(JSON.parse(raw) as Draft);
      } catch {}
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export async function loadDraft(matterId: string, draftId: string): Promise<Draft | null> {
  const file = path.join(matterPaths(matterId).drafts, `${draftId}${DRAFTS_FILE_EXT}`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

/**
 * Markdown export — preserves [[Sn:ref]] markers since the CitationRenderer
 * is UI-only. For handoff to counsel, we emit a footnote table at the end.
 */
export function exportDraftMarkdown(draft: Draft): string {
  const lines: string[] = [];
  lines.push(`# ${draft.displayName}`);
  lines.push("");
  lines.push(`*Generated ${draft.createdAt} — readiness: ${draft.readiness.signReady ? "sign-ready" : "needs review"}*`);
  lines.push("");
  for (const section of draft.sections) {
    lines.push(`## ${section.heading}`);
    lines.push("");
    lines.push(section.answer.trim());
    lines.push("");
  }
  const allCitations = draft.sections.flatMap((s) => s.citations);
  if (allCitations.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("### Sources");
    lines.push("");
    const seen = new Set<string>();
    for (const c of allCitations) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const locator = c.sectionNumber ? `§${c.sectionNumber}` : `p.${c.pageNumber}`;
      lines.push(`- **${c.id}** — ${c.fileName} (${locator})`);
    }
  }
  return lines.join("\n");
}
