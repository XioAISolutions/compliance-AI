/**
 * Participant registry — the single source of truth for agent identities,
 * colors, and human-readable names. Imported by the loop coordinator,
 * the timeline UI, and the /api/agents route.
 *
 * Cannibalized from [bcurts/agentchattr](https://github.com/bcurts/agentchattr)
 * `registry.py` — same concept (runtime agent identities with colors and
 * descriptions), rewritten in TS so our UI can static-analyze it.
 */

import type { Participant, ParticipantId, ParticipantStatus } from "./types.js";

/**
 * The static registry. Status is not stored here — it's ambient runtime
 * state tracked per active session, but defaults are returned by
 * `getParticipant()` callers as they need them.
 */
export const PARTICIPANTS: Record<ParticipantId, Participant> = {
  user: {
    id: "user",
    name: "You",
    color: "slate",
    initials: "U",
    description: "The human operator driving the matter.",
  },
  drafter: {
    id: "drafter",
    name: "Drafter",
    color: "blue",
    initials: "DR",
    description: "Writes policy / procedure / control language from scratch.",
  },
  reviewer: {
    id: "reviewer",
    name: "Reviewer",
    color: "purple",
    initials: "RV",
    description: "Critiques drafts against framework intent and flags gaps.",
  },
  "evidence-collector": {
    id: "evidence-collector",
    name: "Evidence Collector",
    color: "green",
    initials: "EV",
    description: "Identifies what evidence satisfies a control.",
  },
  "risk-assessor": {
    id: "risk-assessor",
    name: "Risk Assessor",
    color: "red",
    initials: "RA",
    description: "Surfaces residual risk and compensating controls.",
  },
  judge: {
    id: "judge",
    name: "Judge",
    color: "amber",
    initials: "JG",
    description:
      "Verdict-only reviewer invoked by the loop coordinator after each drafter round.",
  },
  "om-reviewer": {
    id: "om-reviewer",
    name: "OM Reviewer",
    color: "teal",
    initials: "OM",
    description:
      "Reviews offering memoranda against Ontario securities rules (NI 45-106, OSC 45-501).",
  },
  "kyc-reviewer": {
    id: "kyc-reviewer",
    name: "KYC Reviewer",
    color: "orange",
    initials: "KY",
    description:
      "Reviews KYC/AML files against NI 31-103 Part 13 and FINTRAC obligations.",
  },
  "marketing-reviewer": {
    id: "marketing-reviewer",
    name: "Marketing Reviewer",
    color: "pink",
    initials: "MK",
    description:
      "Reviews sales communications against NI 81-102 Part 15 and CSA Staff Notice 81-330.",
  },
  "response-drafter": {
    id: "response-drafter",
    name: "Response Drafter",
    color: "violet",
    initials: "RE",
    description: "Drafts point-by-point response memos to regulatory inquiries.",
  },
};

export function getParticipant(id: ParticipantId): Participant {
  return PARTICIPANTS[id];
}

export function isParticipantId(s: string): s is ParticipantId {
  return s in PARTICIPANTS;
}

/**
 * Produce a view model for the UI — registry + ambient status for each id.
 * Status defaults to "online" for persona participants and "offline" for
 * `user` (we don't track human online state in-product).
 */
export function toStatusView(
  statuses: Partial<Record<ParticipantId, ParticipantStatus>> = {},
): Array<Participant & { status: ParticipantStatus }> {
  return Object.values(PARTICIPANTS).map((p) => ({
    ...p,
    status: statuses[p.id] ?? (p.id === "user" ? "offline" : "online"),
  }));
}
