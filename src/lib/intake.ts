import fs from "fs/promises";
import path from "path";
import { matterPaths } from "./config";

/**
 * Intake record.
 *
 * Captures the free-form "tell me what happened" data that feeds triage
 * and drafting. Parties and timeline events are structured because they
 * drive downstream retrieval (events become queries; parties surface in
 * draft headers). `freeNarrative` is the client's own wording — we
 * preserve it verbatim so nothing is lost in the structure.
 */

export interface IntakeParty {
  /** "client" | "opposing" | "regulator" | "other" — free-form to keep flexible. */
  role: string;
  name: string;
  notes?: string;
}

export interface IntakeEvent {
  /** ISO date or date-ish string — UI validates, we store as-is. */
  date: string;
  description: string;
}

export interface Intake {
  matterId: string;
  parties: IntakeParty[];
  timeline: IntakeEvent[];
  freeNarrative: string;
  jurisdiction?: string;
  /** Optional hint from the user ("FDCPA violation", "lemon law") to help triage. */
  intakeTypeHint?: string;
  updatedAt: string;
}

const INTAKE_FILE = "intake.json";

export async function loadIntake(matterId: string): Promise<Intake | null> {
  const file = path.join(matterPaths(matterId).intake, INTAKE_FILE);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Intake>;
    return {
      matterId: parsed.matterId ?? matterId,
      parties: Array.isArray(parsed.parties) ? parsed.parties : [],
      timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
      freeNarrative: typeof parsed.freeNarrative === "string" ? parsed.freeNarrative : "",
      jurisdiction: parsed.jurisdiction,
      intakeTypeHint: parsed.intakeTypeHint,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export interface SaveIntakeInput {
  parties?: IntakeParty[];
  timeline?: IntakeEvent[];
  freeNarrative?: string;
  jurisdiction?: string;
  intakeTypeHint?: string;
}

export async function saveIntake(matterId: string, input: SaveIntakeInput): Promise<Intake> {
  const existing = (await loadIntake(matterId)) ?? emptyIntake(matterId);
  const next: Intake = {
    matterId,
    parties: input.parties ?? existing.parties,
    timeline: input.timeline ?? existing.timeline,
    freeNarrative: input.freeNarrative ?? existing.freeNarrative,
    jurisdiction: input.jurisdiction ?? existing.jurisdiction,
    intakeTypeHint: input.intakeTypeHint ?? existing.intakeTypeHint,
    updatedAt: new Date().toISOString(),
  };
  const dir = matterPaths(matterId).intake;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, INTAKE_FILE), JSON.stringify(next, null, 2));
  return next;
}

export function emptyIntake(matterId: string): Intake {
  return {
    matterId,
    parties: [],
    timeline: [],
    freeNarrative: "",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Build a compact prose summary of the intake, used as extra context in
 * drafting and triage prompts. Parties + timeline + narrative collapsed
 * into a regulator-readable paragraph.
 */
export function summarizeIntake(intake: Intake): string {
  const out: string[] = [];
  if (intake.parties.length > 0) {
    out.push("Parties:");
    for (const p of intake.parties) {
      out.push(`  - ${p.role}: ${p.name}${p.notes ? ` (${p.notes})` : ""}`);
    }
  }
  if (intake.timeline.length > 0) {
    out.push("Timeline:");
    const sorted = [...intake.timeline].sort((a, b) => a.date.localeCompare(b.date));
    for (const e of sorted) out.push(`  - ${e.date}: ${e.description}`);
  }
  if (intake.freeNarrative.trim().length > 0) {
    out.push("Narrative:");
    out.push(intake.freeNarrative.trim());
  }
  if (intake.jurisdiction) out.push(`Jurisdiction: ${intake.jurisdiction}`);
  if (intake.intakeTypeHint) out.push(`Claim hint: ${intake.intakeTypeHint}`);
  return out.join("\n");
}
