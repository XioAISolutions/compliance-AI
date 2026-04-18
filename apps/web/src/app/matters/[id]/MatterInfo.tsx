"use client";

/**
 * MatterInfo — consumer-law matter detail sidebar section.
 *
 * Shows the consumer-law-specific fields (parties, claim type, court
 * level, legal regime, class action flag, procedural posture, critical
 * dates) as editable chips and inline controls. Renders nothing if the
 * matter has no consumer-law fields set.
 */

import { useState } from "react";

interface Matter {
  id: string;
  clientName?: string;
  opposingParty?: string;
  courtLevel?: string;
  legalRegime?: string[];
  claimType?: string;
  classActionFlag?: boolean;
  estimatedClassSize?: string;
  harmDescription?: string;
  proceduralPosture?: string;
  limitationDate?: string | Date;
  certificationDate?: string | Date;
  nextDeadline?: string | Date;
  nextDeadlineLabel?: string;
}

interface Props {
  matter: Matter;
  onUpdate: (fields: Record<string, unknown>) => Promise<void>;
}

const CLAIM_LABELS: Record<string, string> = {
  "false-advertising": "False advertising",
  "defective-product": "Defective product",
  "hidden-fees": "Hidden fees",
  "data-breach": "Data breach",
  "privacy-misuse": "Privacy misuse",
  "unfair-terms": "Unfair terms",
  "telemarketing-spam": "Telemarketing",
  "price-fixing": "Price fixing",
  other: "Other",
};

const POSTURES = [
  { value: "investigation", label: "Investigation" },
  { value: "pre-litigation", label: "Pre-litigation" },
  { value: "proposed-class", label: "Proposed class" },
  { value: "certification", label: "Certification" },
  { value: "discovery", label: "Discovery" },
  { value: "settlement", label: "Settlement" },
  { value: "trial", label: "Trial" },
  { value: "appeal", label: "Appeal" },
  { value: "closed", label: "Closed" },
];

const REGIME_LABELS: Record<string, string> = {
  "cpa-ontario": "CPA (ON)",
  "cpa-quebec": "CPA (QC)",
  "cpa-bc": "BPCPA (BC)",
  "cpa-alberta": "CPA (AB)",
  "cpa-saskatchewan": "CPBPA (SK)",
  "cpa-manitoba": "CPA (MB)",
  "cpa-nova-scotia": "CPA (NS)",
  "cpa-new-brunswick": "CPWLA (NB)",
  "cpa-newfoundland": "CPBPA (NL)",
  "cpa-pei": "CPA (PE)",
  "competition-act": "Competition Act",
  pipeda: "PIPEDA",
  casl: "CASL",
  "criminal-code": "Criminal Code",
  "securities-act": "Securities Act",
  "ni-45-106": "NI 45-106",
  "ni-31-103": "NI 31-103",
  "ni-81-102": "NI 81-102",
  other: "Other",
};

function formatDate(d?: string | Date): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function daysUntil(d?: string | Date): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export function MatterInfo({ matter, onUpdate }: Props) {
  const hasConsumerFields = Boolean(
    matter.clientName ||
      matter.opposingParty ||
      matter.claimType ||
      matter.proceduralPosture ||
      matter.classActionFlag,
  );

  const [editingPosture, setEditingPosture] = useState(false);

  if (!hasConsumerFields) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Matter details
      </h2>

      {/* Parties */}
      {(matter.clientName || matter.opposingParty) && (
        <div className="text-xs">
          {matter.clientName && (
            <p>
              <span className="text-neutral-400">Client:</span>{" "}
              <span className="font-medium">{matter.clientName}</span>
            </p>
          )}
          {matter.opposingParty && (
            <p>
              <span className="text-neutral-400">Opposing:</span>{" "}
              <span className="font-medium">{matter.opposingParty}</span>
            </p>
          )}
        </div>
      )}

      {/* Claim type + class action */}
      <div className="flex flex-wrap gap-1.5">
        {matter.claimType && (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            {CLAIM_LABELS[matter.claimType] ?? matter.claimType}
          </span>
        )}
        {matter.classActionFlag && (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            Class action{matter.estimatedClassSize ? ` · ${matter.estimatedClassSize}` : ""}
          </span>
        )}
        {matter.courtLevel && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {matter.courtLevel}
          </span>
        )}
      </div>

      {/* Legal regime tags */}
      {matter.legalRegime && matter.legalRegime.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {matter.legalRegime.map((r) => (
            <span
              key={r}
              className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              {REGIME_LABELS[r] ?? r}
            </span>
          ))}
        </div>
      )}

      {/* Procedural posture — editable */}
      {matter.proceduralPosture && (
        <div className="text-xs">
          <span className="text-neutral-400">Stage: </span>
          {editingPosture ? (
            <select
              value={matter.proceduralPosture}
              onChange={async (e) => {
                await onUpdate({ proceduralPosture: e.target.value });
                setEditingPosture(false);
              }}
              onBlur={() => setEditingPosture(false)}
              autoFocus
              className="rounded border border-neutral-300 bg-transparent px-1 py-0.5 text-xs dark:border-neutral-700"
            >
              {POSTURES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditingPosture(true)}
              className="font-medium underline decoration-dotted underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              {POSTURES.find((p) => p.value === matter.proceduralPosture)?.label ??
                matter.proceduralPosture}
            </button>
          )}
        </div>
      )}

      {/* Critical dates */}
      <div className="space-y-1 text-xs">
        {matter.limitationDate && (
          <DateRow
            label="Limitation"
            date={matter.limitationDate}
            days={daysUntil(matter.limitationDate)}
          />
        )}
        {matter.certificationDate && (
          <DateRow
            label="Certification"
            date={matter.certificationDate}
            days={daysUntil(matter.certificationDate)}
          />
        )}
        {matter.nextDeadline && (
          <DateRow
            label={matter.nextDeadlineLabel ?? "Next deadline"}
            date={matter.nextDeadline}
            days={daysUntil(matter.nextDeadline)}
          />
        )}
      </div>

      {/* Harm description */}
      {matter.harmDescription && (
        <p className="text-[10px] italic text-neutral-500">{matter.harmDescription}</p>
      )}
    </div>
  );
}

function DateRow({
  label,
  date,
  days,
}: {
  label: string;
  date: string | Date;
  days: number | null;
}) {
  return (
    <p>
      <span className="text-neutral-400">{label}:</span>{" "}
      <span className="font-medium">{formatDate(date)}</span>
      {days !== null && (
        <span
          className={`ml-1 text-[10px] font-medium ${
            days < 0 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-neutral-400"
          }`}
        >
          ({days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`})
        </span>
      )}
    </p>
  );
}
