/**
 * Privilege tagging — solicitor-client / work-product / common-interest
 * flags applied to citations, document chunks, evidence items, and
 * audit entries.
 *
 * Why this matters: solicitor-client privilege is the existential
 * risk of any legal-AI system. A citation or audit entry that leaks
 * privileged communications to an external party (opposing counsel,
 * the court, a client, a regulator) is a disciplinary event for the
 * lawyer who filed it. This module is the shared contract that makes
 * privileged content filterable on export.
 *
 * Design choices
 *
 *   1. `"none"` is an explicit value — not an absent field — so a
 *      schema search can prove an entry was considered and not
 *      privileged. "Field missing" would be ambiguous.
 *
 *   2. Per-endpoint defaults (per the product's answer to the
 *      strategic fork): internal exports (/export, /export-redline)
 *      default to SHOWING privileged content because the internal
 *      lawyer is the one reading it. External exports (/audit-export)
 *      default to REDACTING because they're the artifact most
 *      likely to leave the firm. Both honour explicit overrides:
 *        ?redact=privilege  — force redaction even on internal paths
 *        ?show=privilege    — force visibility even on external paths
 *      The operator's choice is ALWAYS audited so the decision is
 *      provable post-hoc.
 */

export type PrivilegeLevel =
  | "none"
  | "solicitor-client"
  | "litigation"
  | "work-product"
  | "common-interest";

export const PRIVILEGE_LEVELS: readonly PrivilegeLevel[] = [
  "none",
  "solicitor-client",
  "litigation",
  "work-product",
  "common-interest",
] as const;

const VALID_LEVELS = new Set<PrivilegeLevel>(PRIVILEGE_LEVELS);

export function isPrivilegeLevel(value: unknown): value is PrivilegeLevel {
  return typeof value === "string" && VALID_LEVELS.has(value as PrivilegeLevel);
}

export function isPrivileged(level: PrivilegeLevel | undefined | null): boolean {
  return level !== undefined && level !== null && level !== "none";
}

/**
 * Default redaction policy by export endpoint. Matches the product
 * decision that internal work is visible to its drafter while the
 * audit-export artifact, most likely to leave the firm, strips
 * privileged content unless the operator explicitly asks for it.
 */
export type ExportAudience = "internal" | "external";

export function defaultRedactionFor(audience: ExportAudience): boolean {
  return audience === "external";
}

/**
 * Parse `?redact=privilege` and `?show=privilege` overrides from a
 * URL. Returns a definitive `redactPrivileged` boolean, factoring in
 * the endpoint's audience default. `?show` wins over `?redact` when
 * both are present, because "show" is the operator accepting
 * responsibility for an audit-worthy decision and we want that to be
 * intentional not accidental.
 */
export function resolveRedactionPolicy(
  url: URL,
  audience: ExportAudience,
): { redactPrivileged: boolean; source: "default" | "override-show" | "override-redact" } {
  const show = url.searchParams.get("show");
  const redact = url.searchParams.get("redact");
  if (show === "privilege") {
    return { redactPrivileged: false, source: "override-show" };
  }
  if (redact === "privilege") {
    return { redactPrivileged: true, source: "override-redact" };
  }
  return { redactPrivileged: defaultRedactionFor(audience), source: "default" };
}

/**
 * Short human-readable badge label for the UI. Deliberately terse
 * — the full level is available in the tooltip. "PRIV" is the
 * industry-standard shorthand.
 */
export function privilegeBadge(level: PrivilegeLevel | undefined | null): string | null {
  if (!isPrivileged(level)) return null;
  return "PRIV";
}

export const REDACTED_PLACEHOLDER = "[REDACTED — privileged]";

/**
 * Redact a citation for export. Returns a shallow copy with
 * content-bearing fields stripped when the citation is privileged and
 * the caller has asked to redact. Non-privileged citations pass
 * through unchanged.
 *
 * Kept as a structural helper (no framework-specific type import) so
 * both the /export and /audit-export routes can call it on their own
 * citation shapes.
 */
export function redactCitation<
  T extends { quote?: string; privilege?: PrivilegeLevel | string | null },
>(c: T, redact: boolean): T {
  if (!redact) return c;
  if (!isPrivileged((c.privilege ?? null) as PrivilegeLevel | null)) return c;
  return {
    ...c,
    quote: REDACTED_PLACEHOLDER,
  };
}

/**
 * Redact an audit entry for export. When privileged, strips
 * inputContent / outputContent (which are where the client-confidential
 * prose lives) while preserving hashes, action, actor, timestamp, and
 * authority ids — the entry is still countable + the hash chain still
 * verifies.
 */
export function redactAuditEntry<
  T extends {
    inputContent?: string | null;
    outputContent?: string | null;
    privilege?: PrivilegeLevel | string | null;
  },
>(entry: T, redact: boolean): T {
  if (!redact) return entry;
  if (!isPrivileged((entry.privilege ?? null) as PrivilegeLevel | null)) return entry;
  return {
    ...entry,
    inputContent: REDACTED_PLACEHOLDER,
    outputContent: REDACTED_PLACEHOLDER,
  };
}

/**
 * Count how many items in a list would be redacted under the given
 * policy. Surfaced in the export response so the UI can show "N
 * privileged items redacted" without having to diff the before/after
 * shapes.
 */
export function countPrivileged<T extends { privilege?: PrivilegeLevel | string | null }>(
  items: readonly T[],
): number {
  let n = 0;
  for (const it of items) {
    if (isPrivileged((it.privilege ?? null) as PrivilegeLevel | null)) n += 1;
  }
  return n;
}

/** Long label for tooltips + the audit-export DOCX. */
export function privilegeLabel(level: PrivilegeLevel | undefined | null): string {
  switch (level) {
    case "solicitor-client":
      return "Solicitor-client privilege";
    case "litigation":
      return "Litigation privilege";
    case "work-product":
      return "Work product";
    case "common-interest":
      return "Common-interest privilege";
    case "none":
    case null:
    case undefined:
    default:
      return "Not privileged";
  }
}
