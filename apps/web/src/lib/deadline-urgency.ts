/**
 * Deadline urgency — derives "how soon is this?" from a matter's
 * `nextDeadline` or `limitationDate`. Drives the matters-list and
 * cockpit deadline badges, plus the digest endpoint that downstream
 * automations use to send reminders.
 *
 * Urgency tiers (ordered most → least urgent):
 *   overdue   → date is in the past
 *   critical  → ≤ 7 days remaining (red)
 *   warning   → ≤ 30 days remaining (amber)
 *   ok        → > 30 days remaining (green)
 *   none      → no deadline set
 *
 * Limitation periods are non-negotiable in Canadian practice; missing
 * one by a single day is malpractice. The "critical" threshold of 7
 * days mirrors the conservative bar most firms use for limitation-
 * docket review meetings.
 */

export type DeadlineUrgency = "overdue" | "critical" | "warning" | "ok" | "none";

export interface DeadlineSummary {
  /** ISO date string the matter is racing toward (or null). */
  date: string | null;
  /** Human-readable label, e.g. "Limitation date" / "Cert hearing". */
  label: string | null;
  /** Days remaining; negative when overdue; null when no deadline. */
  daysRemaining: number | null;
  urgency: DeadlineUrgency;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pick the most-urgent deadline among the matter's deadline-shaped
 * fields. Limitation date almost always wins because it's a hard
 * statutory bar, but a `nextDeadline` (e.g. discovery cutoff) closer
 * in time still surfaces if it's more imminent.
 */
export function pickMatterDeadline(matter: {
  nextDeadline?: string | Date | null;
  nextDeadlineLabel?: string | null;
  limitationDate?: string | Date | null;
  certificationDate?: string | Date | null;
}): DeadlineSummary {
  const candidates: Array<{ date: Date; label: string }> = [];
  if (matter.limitationDate) {
    candidates.push({ date: toDate(matter.limitationDate), label: "Limitation date" });
  }
  if (matter.certificationDate) {
    candidates.push({ date: toDate(matter.certificationDate), label: "Certification" });
  }
  if (matter.nextDeadline) {
    candidates.push({
      date: toDate(matter.nextDeadline),
      label: matter.nextDeadlineLabel || "Next deadline",
    });
  }
  if (candidates.length === 0) {
    return { date: null, label: null, daysRemaining: null, urgency: "none" };
  }
  // Sort by absolute imminence (overdue items still surface).
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const winner = candidates[0]!;
  const days = daysUntil(winner.date);
  return {
    date: winner.date.toISOString().slice(0, 10),
    label: winner.label,
    daysRemaining: days,
    urgency: classify(days),
  };
}

/**
 * Days until `date`, rounded toward negative infinity so a deadline
 * that falls today reports 0 (not -0.5 from a half-day clock skew).
 * Negative numbers mean overdue.
 */
export function daysUntil(date: Date, now: Date = new Date()): number {
  // Anchor both dates to UTC midnight so DST + timezone don't push a
  // deadline between buckets. The matters list rendering should match
  // a lawyer's mental model of "how many calendar days until X".
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((target - today) / MS_PER_DAY);
}

export function classify(daysRemaining: number | null): DeadlineUrgency {
  if (daysRemaining === null) return "none";
  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= 7) return "critical";
  if (daysRemaining <= 30) return "warning";
  return "ok";
}

/** Tailwind palette per urgency. Centralised so badges + cockpit + digest agree. */
export function urgencyPalette(u: DeadlineUrgency): {
  bg: string;
  text: string;
  border: string;
} {
  switch (u) {
    case "overdue":
      return {
        bg: "bg-red-100 dark:bg-red-950",
        text: "text-red-900 dark:text-red-200",
        border: "border-red-300 dark:border-red-800",
      };
    case "critical":
      return {
        bg: "bg-rose-100 dark:bg-rose-950",
        text: "text-rose-900 dark:text-rose-200",
        border: "border-rose-300 dark:border-rose-800",
      };
    case "warning":
      return {
        bg: "bg-amber-100 dark:bg-amber-950",
        text: "text-amber-900 dark:text-amber-200",
        border: "border-amber-300 dark:border-amber-800",
      };
    case "ok":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        text: "text-emerald-900 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-900",
      };
    case "none":
    default:
      return {
        bg: "bg-neutral-50 dark:bg-neutral-900",
        text: "text-neutral-500 dark:text-neutral-400",
        border: "border-neutral-200 dark:border-neutral-800",
      };
  }
}

/** Human-readable label, e.g. "Overdue 3d", "Due in 11d", "Due today". */
export function urgencyLabel(s: DeadlineSummary): string {
  if (s.daysRemaining === null) return "No deadline";
  if (s.daysRemaining < 0) return `Overdue ${Math.abs(s.daysRemaining)}d`;
  if (s.daysRemaining === 0) return "Due today";
  if (s.daysRemaining === 1) return "Due tomorrow";
  return `Due in ${s.daysRemaining}d`;
}

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}
