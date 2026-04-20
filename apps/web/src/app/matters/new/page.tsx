"use client";

/**
 * /matters/new — guided matter creation wizard.
 *
 * Four steps for consumer-law matters; a fast inline form for securities.
 * Presets for common consumer scenarios pre-fill jurisdiction, court level,
 * legal regime, and claim type to reduce creation friction.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MatterKind = "securities" | "consumer";

interface WizardState {
  kind: MatterKind;
  // Securities fields (always present)
  title: string;
  jurisdiction: string;
  registrationCategory: string;
  taskType: string;
  // Consumer-law fields
  clientName: string;
  opposingParty: string;
  courtLevel: string;
  legalRegime: string[];
  claimType: string;
  classActionFlag: boolean;
  estimatedClassSize: string;
  harmDescription: string;
  proceduralPosture: string;
  limitationDate: string;
  certificationDate: string;
  nextDeadline: string;
  nextDeadlineLabel: string;
}

const INITIAL: WizardState = {
  kind: "consumer",
  title: "",
  jurisdiction: "ontario",
  registrationCategory: "none",
  taskType: "om-review",
  clientName: "",
  opposingParty: "",
  courtLevel: "",
  legalRegime: [],
  claimType: "",
  classActionFlag: false,
  estimatedClassSize: "",
  harmDescription: "",
  proceduralPosture: "investigation",
  limitationDate: "",
  certificationDate: "",
  nextDeadline: "",
  nextDeadlineLabel: "",
};

const PRESETS: Array<{
  label: string;
  icon: string;
  defaults: Partial<WizardState>;
}> = [
  {
    label: "Product defect class action",
    icon: "🔧",
    defaults: {
      kind: "consumer",
      jurisdiction: "ontario",
      courtLevel: "superior",
      legalRegime: ["cpa-ontario"],
      claimType: "defective-product",
      classActionFlag: true,
      proceduralPosture: "investigation",
      registrationCategory: "none",
      taskType: "om-review",
    },
  },
  {
    label: "Misleading pricing complaint",
    icon: "💰",
    defaults: {
      kind: "consumer",
      jurisdiction: "ontario",
      courtLevel: "superior",
      legalRegime: ["cpa-ontario", "competition-act"],
      claimType: "false-advertising",
      classActionFlag: false,
      proceduralPosture: "pre-litigation",
      registrationCategory: "none",
      taskType: "om-review",
    },
  },
  {
    label: "Data breach investigation",
    icon: "🔒",
    defaults: {
      kind: "consumer",
      jurisdiction: "federal",
      courtLevel: "federal",
      legalRegime: ["pipeda"],
      claimType: "data-breach",
      classActionFlag: true,
      proceduralPosture: "investigation",
      registrationCategory: "none",
      taskType: "pipeda-check",
    },
  },
  {
    label: "PIPEDA / privacy review",
    icon: "🔐",
    defaults: {
      kind: "securities",
      jurisdiction: "federal",
      registrationCategory: "none",
      taskType: "pipeda-check",
    },
  },
  {
    label: "Court AI-use disclosure memo",
    icon: "⚖️",
    defaults: {
      kind: "securities",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "court-ai-disclosure",
    },
  },
  {
    label: "Missing-authority scan (audit existing output)",
    icon: "🧐",
    defaults: {
      kind: "securities",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "missing-authority-scan",
    },
  },
  {
    label: "Telemarketing / CASL complaint",
    icon: "📞",
    defaults: {
      kind: "consumer",
      jurisdiction: "federal",
      courtLevel: "federal",
      legalRegime: ["casl"],
      claimType: "telemarketing-spam",
      classActionFlag: false,
      proceduralPosture: "investigation",
      registrationCategory: "none",
      taskType: "om-review",
    },
  },
  {
    label: "Securities review (OM / KYC / Marketing)",
    icon: "📄",
    defaults: {
      kind: "securities",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    },
  },
];

const JURISDICTIONS = [
  { value: "ontario", label: "Ontario" },
  { value: "quebec", label: "Quebec" },
  { value: "british-columbia", label: "British Columbia" },
  { value: "alberta", label: "Alberta" },
  { value: "saskatchewan", label: "Saskatchewan" },
  { value: "manitoba", label: "Manitoba" },
  { value: "nova-scotia", label: "Nova Scotia" },
  { value: "new-brunswick", label: "New Brunswick" },
  { value: "newfoundland", label: "Newfoundland & Labrador" },
  { value: "pei", label: "Prince Edward Island" },
  { value: "northwest-territories", label: "Northwest Territories" },
  { value: "yukon", label: "Yukon" },
  { value: "nunavut", label: "Nunavut" },
  { value: "federal", label: "Federal" },
  { value: "multi-provincial", label: "Multi-provincial" },
];

const COURT_LEVELS = [
  { value: "small-claims", label: "Small Claims Court" },
  { value: "superior", label: "Superior Court" },
  { value: "divisional", label: "Divisional Court" },
  { value: "court-of-appeal", label: "Court of Appeal" },
  { value: "federal", label: "Federal Court" },
  { value: "supreme", label: "Supreme Court of Canada" },
];

const LEGAL_REGIMES = [
  { value: "cpa-ontario", label: "Consumer Protection Act (Ontario)" },
  { value: "cpa-quebec", label: "Consumer Protection Act (Quebec)" },
  { value: "cpa-bc", label: "BPCPA (British Columbia)" },
  { value: "cpa-alberta", label: "Consumer Protection Act (Alberta)" },
  { value: "cpa-saskatchewan", label: "Consumer Protection & Business Practices Act (SK)" },
  { value: "cpa-manitoba", label: "Consumer Protection Act (Manitoba)" },
  { value: "cpa-nova-scotia", label: "Consumer Protection Act (Nova Scotia)" },
  { value: "cpa-new-brunswick", label: "Consumer Product Warranty & Liability Act (NB)" },
  { value: "cpa-newfoundland", label: "Consumer Protection & Business Practices Act (NL)" },
  { value: "cpa-pei", label: "Consumer Protection Act (PEI)" },
  { value: "competition-act", label: "Competition Act (federal)" },
  { value: "pipeda", label: "PIPEDA (federal privacy)" },
  { value: "casl", label: "CASL (anti-spam)" },
  { value: "criminal-code", label: "Criminal Code (fraud / deceptive marketing)" },
  { value: "securities-act", label: "Securities Act" },
  { value: "other", label: "Other" },
];

const CLAIM_TYPES = [
  { value: "false-advertising", label: "False / misleading advertising", icon: "📢" },
  { value: "defective-product", label: "Defective product", icon: "🔧" },
  { value: "hidden-fees", label: "Hidden fees / unfair pricing", icon: "💰" },
  { value: "data-breach", label: "Data breach", icon: "🔒" },
  { value: "privacy-misuse", label: "Privacy misuse", icon: "👁" },
  { value: "unfair-terms", label: "Unfair contract terms", icon: "📋" },
  { value: "telemarketing-spam", label: "Telemarketing / spam", icon: "📞" },
  { value: "price-fixing", label: "Price fixing / cartel", icon: "🤝" },
  { value: "other", label: "Other", icon: "❓" },
];

const POSTURES = [
  { value: "investigation", label: "Investigation" },
  { value: "pre-litigation", label: "Pre-litigation demand" },
  { value: "proposed-class", label: "Proposed class action" },
  { value: "certification", label: "Certification" },
  { value: "discovery", label: "Discovery" },
  { value: "settlement", label: "Settlement" },
  { value: "trial", label: "Trial" },
  { value: "appeal", label: "Appeal" },
];

const REGISTRATION_CATEGORIES = [
  { value: "emd", label: "Exempt Market Dealer" },
  { value: "pm", label: "Portfolio Manager" },
  { value: "iiroc", label: "IIROC Dealer (CIRO)" },
  { value: "issuer", label: "Reporting Issuer" },
  { value: "none", label: "None / Outside Counsel" },
];

const TASK_TYPES = [
  { value: "om-review", label: "Review offering memo", icon: "📄", lane: "securities" },
  { value: "kyc-gap-check", label: "KYC / AML gap check", icon: "🔍", lane: "securities" },
  { value: "marketing-signoff", label: "Marketing sign-off", icon: "📣", lane: "securities" },
  { value: "response-memo", label: "Regulator response memo", icon: "✉️", lane: "regulator" },
  { value: "court-ai-disclosure", label: "Court AI-use disclosure memo", icon: "⚖️", lane: "court" },
  { value: "pipeda-check", label: "PIPEDA / privacy review", icon: "🔒", lane: "privacy" },
  { value: "missing-authority-scan", label: "Missing-authority scan (audit existing output)", icon: "🧐", lane: "audit" },
];

export default function NewMatterPage() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>({ ...INITIAL });
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setState((prev) => ({ ...prev, ...preset.defaults }));
    setStep(state.kind === "securities" || preset.defaults.kind === "securities" ? 0 : 1);
  }

  function autoTitle(): string {
    if (state.title) return state.title;
    const parts: string[] = [];
    if (state.clientName) parts.push(state.clientName);
    if (state.opposingParty) parts.push(`v. ${state.opposingParty}`);
    const ct = CLAIM_TYPES.find((c) => c.value === state.claimType);
    if (ct) parts.push(`(${ct.label})`);
    return parts.join(" ") || "Untitled Matter";
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const title = autoTitle();
      const body: Record<string, unknown> = {
        title,
        jurisdiction: state.jurisdiction,
        registrationCategory: state.registrationCategory,
        taskType: state.taskType,
      };
      if (state.kind === "consumer") {
        if (state.clientName) body.clientName = state.clientName;
        if (state.opposingParty) body.opposingParty = state.opposingParty;
        if (state.courtLevel) body.courtLevel = state.courtLevel;
        if (state.legalRegime.length > 0) body.legalRegime = state.legalRegime;
        if (state.claimType) body.claimType = state.claimType;
        body.classActionFlag = state.classActionFlag;
        if (state.estimatedClassSize) body.estimatedClassSize = state.estimatedClassSize;
        if (state.harmDescription) body.harmDescription = state.harmDescription;
        if (state.proceduralPosture) body.proceduralPosture = state.proceduralPosture;
        if (state.limitationDate) body.limitationDate = state.limitationDate;
        if (state.certificationDate) body.certificationDate = state.certificationDate;
        if (state.nextDeadline) body.nextDeadline = state.nextDeadline;
        if (state.nextDeadlineLabel) body.nextDeadlineLabel = state.nextDeadlineLabel;
      }
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const matter = (await res.json()) as { id: string };
      router.push(`/matters/${matter.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const isSecurities = state.kind === "securities";
  const maxStep = isSecurities ? 0 : 3;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/matters" className="text-xs text-neutral-400 hover:text-neutral-600">
            ← All matters
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">New matter</h1>
        </div>
      </div>

      {/* Presets */}
      <div className="mt-6">
        <p className="text-xs font-medium text-neutral-500">Quick start</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="rounded-lg border border-neutral-200 px-3 py-2 text-left text-xs transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              <span className="mr-1.5">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step indicator */}
      {!isSecurities && (
        <div className="mt-8 flex items-center gap-1">
          {["Parties", "Jurisdiction", "Claim & Dates", "Review"].map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : i < step
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      )}

      {/* Securities fast path */}
      {isSecurities && (
        <div className="mt-6 space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <Field label="Title">
            <input type="text" value={state.title} onChange={(e) => set("title", e.target.value)}
              placeholder="e.g., ABC Capital OM Review — Q2 2026"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
          </Field>
          <Field label="Task type">
            <TaskTypePicker
              value={state.taskType}
              onChange={(v) => set("taskType", v)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Jurisdiction">
              <Select
                value={state.jurisdiction}
                onChange={(v) => set("jurisdiction", v)}
                options={JURISDICTIONS}
              />
            </Field>
            <Field label="Registration">
              <Select
                value={state.registrationCategory}
                onChange={(v) => set("registrationCategory", v)}
                options={REGISTRATION_CATEGORIES}
              />
            </Field>
          </div>
          <Field label="Source packs in scope">
            <SourcePackChips
              taskType={state.taskType}
              registrationCategory={state.registrationCategory}
            />
          </Field>
        </div>
      )}

      {/* Consumer step 1: Parties */}
      {!isSecurities && step === 0 && (
        <div className="mt-6 space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <Field label="Client name (individual or class representative)">
            <input type="text" value={state.clientName} onChange={(e) => set("clientName", e.target.value)}
              placeholder="Jane Doe" className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
          </Field>
          <Field label="Opposing party (merchant, manufacturer, bank, platform)">
            <input type="text" value={state.opposingParty} onChange={(e) => set("opposingParty", e.target.value)}
              placeholder="Acme Corp." className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
          </Field>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={state.classActionFlag}
                onChange={(e) => set("classActionFlag", e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300" />
              Potential class action
            </label>
          </div>
          {state.classActionFlag && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Estimated class size">
                <input type="text" value={state.estimatedClassSize}
                  onChange={(e) => set("estimatedClassSize", e.target.value)}
                  placeholder="e.g., 5,000–10,000 consumers"
                  className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
              </Field>
              <Field label="Harm description">
                <input type="text" value={state.harmDescription}
                  onChange={(e) => set("harmDescription", e.target.value)}
                  placeholder="e.g., $50–200 overcharge per consumer"
                  className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
              </Field>
            </div>
          )}
        </div>
      )}

      {/* Consumer step 2: Jurisdiction & Regime */}
      {!isSecurities && step === 1 && (
        <div className="mt-6 space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Jurisdiction">
              <Select value={state.jurisdiction} onChange={(v) => set("jurisdiction", v)} options={JURISDICTIONS} />
            </Field>
            <Field label="Court level">
              <Select value={state.courtLevel} onChange={(v) => set("courtLevel", v)} options={COURT_LEVELS} />
            </Field>
          </div>
          <Field label="Legal regime (select all that apply)">
            <div className="mt-1 grid grid-cols-2 gap-2">
              {LEGAL_REGIMES.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={state.legalRegime.includes(r.value)}
                    onChange={(e) => {
                      if (e.target.checked) set("legalRegime", [...state.legalRegime, r.value]);
                      else set("legalRegime", state.legalRegime.filter((v) => v !== r.value));
                    }}
                    className="h-3.5 w-3.5 rounded border-neutral-300" />
                  {r.label}
                </label>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* Consumer step 3: Claim & Dates */}
      {!isSecurities && step === 2 && (
        <div className="mt-6 space-y-4 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <Field label="Claim type">
            <div className="mt-1 grid grid-cols-3 gap-2">
              {CLAIM_TYPES.map((ct) => (
                <button key={ct.value}
                  onClick={() => set("claimType", ct.value)}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-colors ${
                    state.claimType === ct.value
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  }`}
                >
                  <span>{ct.icon}</span> {ct.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Procedural posture">
            <Select value={state.proceduralPosture} onChange={(v) => set("proceduralPosture", v)} options={POSTURES} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Limitation date">
              <input type="date" value={state.limitationDate}
                onChange={(e) => set("limitationDate", e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
            </Field>
            {state.classActionFlag && (
              <Field label="Certification date">
                <input type="date" value={state.certificationDate}
                  onChange={(e) => set("certificationDate", e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
              </Field>
            )}
          </div>
          <Field label="Matter title">
            <input type="text" value={state.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={autoTitle()}
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700" />
            <p className="mt-1 text-[10px] text-neutral-400">
              Auto-generated from parties + claim type if left empty.
            </p>
          </Field>
        </div>
      )}

      {/* Consumer step 4: Review & Confirm */}
      {!isSecurities && step === 3 && (
        <div className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Review</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <SummaryRow label="Title" value={autoTitle()} />
            <SummaryRow label="Client" value={state.clientName || "—"} />
            <SummaryRow label="Opposing party" value={state.opposingParty || "—"} />
            <SummaryRow label="Jurisdiction" value={JURISDICTIONS.find((j) => j.value === state.jurisdiction)?.label ?? state.jurisdiction} />
            <SummaryRow label="Court" value={COURT_LEVELS.find((c) => c.value === state.courtLevel)?.label ?? "—"} />
            <SummaryRow label="Claim type" value={CLAIM_TYPES.find((c) => c.value === state.claimType)?.label ?? "—"} />
            <SummaryRow label="Class action" value={state.classActionFlag ? `Yes (${state.estimatedClassSize || "size TBD"})` : "No"} />
            <SummaryRow label="Stage" value={POSTURES.find((p) => p.value === state.proceduralPosture)?.label ?? state.proceduralPosture} />
            <SummaryRow label="Legal regime" value={state.legalRegime.map((r) => LEGAL_REGIMES.find((lr) => lr.value === r)?.label ?? r).join(", ") || "—"} />
            <SummaryRow label="Limitation date" value={state.limitationDate || "—"} />
            {state.harmDescription && <SummaryRow label="Harm" value={state.harmDescription} />}
          </div>
        </div>
      )}

      {/* Navigation + submit */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {!isSecurities && step > 0 && (
            <button onClick={() => setStep(step - 1)}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">
              Back
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/matters"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900">
            Cancel
          </Link>
          {(isSecurities || step === maxStep) ? (
            <button onClick={submit} disabled={submitting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900">
              {submitting ? "Creating…" : "Create matter"}
            </button>
          ) : (
            <button onClick={() => setStep(step + 1)}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900">
              Next
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700">
      <option value="">Select…</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/**
 * TaskTypePicker — grid of all 7 task types. Replaces the old `<select>`
 * so the new review modes (PIPEDA, court AI disclosure, missing-authority
 * scan) are discoverable without a dropdown dive.
 */
function TaskTypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {TASK_TYPES.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
              selected
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            }`}
          >
            <span className="mt-0.5 text-sm">{t.icon}</span>
            <span className="leading-snug">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface SourcePackSummary {
  id: string;
  label: string;
  description: string;
  jurisdictions: string[];
  practiceAreas: string[];
  itemCount: number;
}

/**
 * SourcePackChips — fetches /api/source-packs?taskType=...&registrationCategory=...
 * and renders the bundled authority packs that WILL be in scope when the
 * review runs. Gives the lawyer a "know what's in scope before running"
 * moment that the flat task-type dropdown never did.
 */
function SourcePackChips({
  taskType,
  registrationCategory,
}: {
  taskType: string;
  registrationCategory: string;
}) {
  const [packs, setPacks] = useState<SourcePackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    const params = new URLSearchParams();
    if (taskType) params.set("taskType", taskType);
    if (registrationCategory) params.set("registrationCategory", registrationCategory);
    fetch(`/api/source-packs?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((body: { packs: SourcePackSummary[] }) => {
        if (!cancelled) setPacks(body.packs ?? []);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskType, registrationCategory]);

  if (loading) {
    return <p className="mt-1 text-[10px] text-neutral-400">Loading packs…</p>;
  }
  if (err) {
    return <p className="mt-1 text-[10px] text-red-500">Packs error: {err}</p>;
  }
  if (packs.length === 0) {
    return (
      <p className="mt-1 text-[10px] text-neutral-400">
        No packs registered for this task type.
      </p>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {packs.map((p) => (
        <span
          key={p.id}
          title={p.description}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] dark:border-neutral-800 dark:bg-neutral-900"
        >
          <span className="font-medium">{p.label}</span>
          <span className="rounded-sm bg-neutral-200 px-1 font-mono text-[9px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {p.itemCount}
          </span>
        </span>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-neutral-400">{label}:</span>{" "}
      <span className="font-medium">{value}</span>
    </div>
  );
}
