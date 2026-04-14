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

// --- Complaint (civil) -----------------------------------------------------

const COMPLAINT: DraftTemplate = {
  kind: "complaint",
  displayName: "Civil complaint",
  promptProfile: "plaintiff_demand",
  sections: [
    {
      id: "caption",
      heading: "Caption and parties",
      guidance:
        "Produce a federal-style caption block followed by a short Parties section. Name the plaintiff(s) and defendant(s) using the intake. Cite any client-facts chunk that establishes who a party is. Do not cite statutes in this section.",
      requiredCitations: ["client_facts", "correspondence"],
    },
    {
      id: "jurisdiction",
      heading: "Jurisdiction and venue",
      guidance:
        "State the basis for subject-matter jurisdiction and venue. Every jurisdictional assertion must cite the statute or regulation that grants it. If the intake supplies the client's address or the forum, cite the client-facts source for that fact.",
      requiredCitations: ["statute", "regulation", "client_facts"],
    },
    {
      id: "facts",
      heading: "Factual allegations",
      guidance:
        "Enumerate numbered factual allegations (¶1, ¶2, ...) drawn ONLY from the sources. Each paragraph is one discrete fact, cited to the specific client-facts, correspondence, or contract chunk that establishes it. If a critical fact is absent, emit [[NEEDED: <fact>]] and do not fabricate.",
      requiredCitations: ["client_facts", "correspondence", "contract"],
      topK: 10,
    },
    {
      id: "causes",
      heading: "Causes of action",
      guidance:
        "For each violated statute/regulation, produce a numbered Count. Under each Count, quote or paraphrase the controlling statutory language (cite the statute), enumerate its elements (cite the statute), and for each element cite the factual paragraph or client-facts chunk that satisfies it. Emit [[NEEDED: <element>]] when no fact supports an element.",
      requiredCitations: ["statute", "regulation", "client_facts", "correspondence", "contract"],
      topK: 12,
    },
    {
      id: "prayer",
      heading: "Prayer for relief",
      guidance:
        "State the concrete relief requested. For each remedy, cite the statute or regulation that makes it available. Do not invent dollar figures; if the intake lacks quantum, emit [[NEEDED: damages figure]] and continue.",
      requiredCitations: ["statute", "regulation"],
    },
  ],
};

// --- Internal memo ---------------------------------------------------------

const INTERNAL_MEMO: DraftTemplate = {
  kind: "internal_memo",
  displayName: "Internal memo",
  promptProfile: "internal_memo",
  sections: [
    {
      id: "issue",
      heading: "ISSUE",
      guidance:
        "State the legal question presented by the matter in one or two sentences. Cite the intake or client-facts source that frames the question. Do not expand beyond what the intake establishes.",
      requiredCitations: ["client_facts", "correspondence", "contract"],
    },
    {
      id: "rule",
      heading: "RULE",
      guidance:
        "State the controlling rule(s). For each rule, quote or paraphrase the statute/regulation, cite it, and enumerate its elements with a citation per element. If caselaw is in the sources, cite it for interpretive gloss.",
      requiredCitations: ["statute", "regulation", "caselaw"],
      topK: 8,
    },
    {
      id: "application",
      heading: "APPLICATION",
      guidance:
        "Apply the rule to the matter's facts. For each element, name the element and cite a specific fact chunk that satisfies it or emit [[NEEDED: <what is missing>]] when the sources do not establish it. Keep this section analytical and neutral.",
      requiredCitations: ["statute", "regulation", "client_facts", "correspondence", "contract"],
      topK: 10,
    },
    {
      id: "conclusion",
      heading: "CONCLUSION",
      guidance:
        "State the conclusion in one paragraph. Identify outstanding gaps (elements not yet supported) and recommend the next concrete step. Citations optional here; do not invent authority.",
      requiredCitations: [],
    },
  ],
};

// --- Response to regulator -------------------------------------------------

const RESPONSE_TO_REGULATOR: DraftTemplate = {
  kind: "response_to_regulator",
  displayName: "Response to regulator",
  promptProfile: "compliance_qa",
  sections: [
    {
      id: "opening",
      heading: "Opening and reference",
      guidance:
        "Write a formal opening that references the regulator's inquiry. Identify the respondent and the inquiry number or subject line as captured in the intake. Cite the intake or correspondence chunk that captures the inquiry. Do not cite statutes yet.",
      requiredCitations: ["correspondence", "client_facts"],
    },
    {
      id: "facts",
      heading: "Statement of facts",
      guidance:
        "Summarize the facts the regulator asked about. Every factual claim must cite a client-facts, correspondence, or contract chunk. Be concise and chronological; do not editorialize.",
      requiredCitations: ["client_facts", "correspondence", "contract"],
      topK: 8,
    },
    {
      id: "compliance",
      heading: "Compliance posture",
      guidance:
        "For each statute or regulation the inquiry implicates, quote or paraphrase the binding language (cite the source), state the respondent's posture, and cite the client-facts or correspondence chunk that demonstrates compliance. Emit [[NEEDED: <what is missing>]] when evidence is absent.",
      requiredCitations: ["statute", "regulation", "client_facts", "correspondence"],
      topK: 10,
    },
    {
      id: "closing",
      heading: "Closing and offer to cooperate",
      guidance:
        "Close formally. Offer a contact for follow-up. Citations optional; keep the tone professional and non-adversarial.",
      requiredCitations: [],
    },
  ],
};

export const DRAFT_TEMPLATES: Record<DraftKind, DraftTemplate | null> = {
  demand_letter: DEMAND_LETTER,
  complaint: COMPLAINT,
  internal_memo: INTERNAL_MEMO,
  response_to_regulator: RESPONSE_TO_REGULATOR,
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
  kindDisplayName: string,
): string {
  const parts: string[] = [];
  parts.push(`You are drafting the "${template.heading}" section of a ${kindDisplayName} for matter "${matter.displayName}".`);
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
    const question = buildSectionQuestion(sec, matter, intake, template.displayName);
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
