/**
 * Control — the central data type.
 *
 * Design: Option B (per-framework types + shared base) in code, paired with
 * Option A (unified table + jsonb metadata) in the DB layer. The split gives
 * type safety at the reasoning/UI layer and flexibility at the storage layer.
 *
 * Controls anchor: evidence, agent reasoning, approvals, audit trail.
 */

export type FrameworkId = "soc2" | "gdpr" | "eu-ai-act" | "iso-27001";

export type ControlStatus =
  | "not-started"
  | "in-progress"
  | "evidence-collected"
  | "reviewed"
  | "approved"
  | "exception";

export interface BaseControl {
  /** Stable UUID. */
  id: string;
  /** Human-readable slug: `soc2.cc6.1`, `gdpr.art-30`. Unique globally. */
  slug: string;
  framework: FrameworkId;
  /** Framework-native code: `CC6.1`, `Art. 30`, `A.8.2`. */
  code: string;
  title: string;
  description: string;
  status: ControlStatus;
  /** `null` until an owner is assigned. */
  ownerId: string | null;
  /** Tenant scoping. */
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── SOC 2 ────────────────────────────────────────────────────────────
export type SOC2TSC = "CC" | "A" | "C" | "PI" | "P";
export interface SOC2Control extends BaseControl {
  framework: "soc2";
  tsc: SOC2TSC;
  /** Points of focus — granular sub-requirements the auditor evaluates. */
  pointsOfFocus: string[];
  auditPeriod: "type-1" | "type-2";
}

// ── GDPR ─────────────────────────────────────────────────────────────
export type GDPRLawfulBasis =
  | "consent"
  | "contract"
  | "legal-obligation"
  | "vital-interests"
  | "public-task"
  | "legitimate-interests";

export interface GDPRControl extends BaseControl {
  framework: "gdpr";
  /** e.g. "Art. 30" */
  article: string;
  /** e.g. "Chapter IV — Controller and Processor" */
  chapter: string;
  lawfulBasis?: GDPRLawfulBasis[];
  /** Linked data-subject right if applicable, e.g. "right-of-access". */
  dataSubjectRight?: string;
}

// ── EU AI Act ────────────────────────────────────────────────────────
export type EUAIActRiskTier =
  | "unacceptable"
  | "high"
  | "limited"
  | "minimal"
  | "gpai";

export interface EUAIActControl extends BaseControl {
  framework: "eu-ai-act";
  /** e.g. "Art. 9" */
  article: string;
  riskTier: EUAIActRiskTier;
  /** e.g. "Annex III" */
  annex?: string;
}

// ── ISO 27001 ────────────────────────────────────────────────────────
export type ISO27001Domain =
  | "organizational"
  | "people"
  | "physical"
  | "technological";

export interface ISO27001Control extends BaseControl {
  framework: "iso-27001";
  /** e.g. "A.8.2" */
  annexA: string;
  domain: ISO27001Domain;
}

// ── Union ────────────────────────────────────────────────────────────
export type Control =
  | SOC2Control
  | GDPRControl
  | EUAIActControl
  | ISO27001Control;

/** Narrow a Control to its framework-specific type at runtime. */
export function isFramework<F extends FrameworkId>(
  control: Control,
  framework: F,
): control is Extract<Control, { framework: F }> {
  return control.framework === framework;
}
