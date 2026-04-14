"use client";
import { useEffect, useState } from "react";

interface IntakeParty { role: string; name: string; notes?: string; }
interface IntakeEvent { date: string; description: string; }
interface Intake {
  matterId: string;
  parties: IntakeParty[];
  timeline: IntakeEvent[];
  freeNarrative: string;
  jurisdiction?: string;
  intakeTypeHint?: string;
  updatedAt: string;
}

export function IntakePanel({ matterId }: { matterId: string }) {
  const [intake, setIntake] = useState<Intake | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/matters/${matterId}/intake`);
        if (r.ok) {
          const d = await r.json();
          setIntake(d.intake);
        }
      } catch {}
    })();
  }, [matterId]);

  if (!intake) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading intake...</div>
    );
  }

  function update<K extends keyof Intake>(key: K, value: Intake[K]) {
    setIntake((prev) => (prev ? { ...prev, [key]: value } : prev));
  }
  function addParty() {
    update("parties", [...intake!.parties, { role: "client", name: "" }]);
  }
  function updateParty(i: number, patch: Partial<IntakeParty>) {
    update("parties", intake!.parties.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function removeParty(i: number) {
    update("parties", intake!.parties.filter((_, idx) => idx !== i));
  }
  function addEvent() {
    update("timeline", [...intake!.timeline, { date: "", description: "" }]);
  }
  function updateEvent(i: number, patch: Partial<IntakeEvent>) {
    update("timeline", intake!.timeline.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function removeEvent(i: number) {
    update("timeline", intake!.timeline.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!intake) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/matters/${matterId}/intake`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parties: intake.parties,
          timeline: intake.timeline,
          freeNarrative: intake.freeNarrative,
          jurisdiction: intake.jurisdiction,
          intakeTypeHint: intake.intakeTypeHint,
        }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Save failed");
      }
      const d = await r.json();
      setIntake(d.intake);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="p-6 overflow-auto">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-lg font-semibold mb-1">Intake</h2>
        <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          What happened, who's involved, and when. This data feeds drafting and triage.
        </p>

        <Section title="Parties">
          {intake.parties.map((p, i) => (
            <div key={i} className="flex gap-2 mb-2 items-start">
              <select
                value={p.role}
                onChange={(e) => updateParty(i, { role: e.target.value })}
                className="text-sm py-1 px-2 rounded bg-transparent border"
                style={{ borderColor: "var(--border)", width: 140 }}
              >
                <option value="client">client</option>
                <option value="opposing">opposing</option>
                <option value="regulator">regulator</option>
                <option value="other">other</option>
              </select>
              <input
                value={p.name}
                onChange={(e) => updateParty(i, { name: e.target.value })}
                placeholder="Name"
                className="flex-1 text-sm py-1 px-2 rounded bg-transparent border"
                style={{ borderColor: "var(--border)" }}
              />
              <input
                value={p.notes ?? ""}
                onChange={(e) => updateParty(i, { notes: e.target.value })}
                placeholder="Notes"
                className="flex-1 text-sm py-1 px-2 rounded bg-transparent border"
                style={{ borderColor: "var(--border)" }}
              />
              <button onClick={() => removeParty(i)} className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Remove</button>
            </div>
          ))}
          <button onClick={addParty} className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>+ Add party</button>
        </Section>

        <Section title="Timeline">
          {intake.timeline.map((e, i) => (
            <div key={i} className="flex gap-2 mb-2 items-start">
              <input
                type="date"
                value={e.date}
                onChange={(ev) => updateEvent(i, { date: ev.target.value })}
                className="text-sm py-1 px-2 rounded bg-transparent border"
                style={{ borderColor: "var(--border)", width: 160 }}
              />
              <textarea
                value={e.description}
                onChange={(ev) => updateEvent(i, { description: ev.target.value })}
                placeholder="What happened"
                className="flex-1 text-sm py-1 px-2 rounded bg-transparent border"
                style={{ borderColor: "var(--border)", minHeight: 36 }}
              />
              <button onClick={() => removeEvent(i)} className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Remove</button>
            </div>
          ))}
          <button onClick={addEvent} className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>+ Add event</button>
        </Section>

        <Section title="Narrative">
          <textarea
            value={intake.freeNarrative}
            onChange={(e) => update("freeNarrative", e.target.value)}
            placeholder="In the client's own words..."
            className="w-full text-sm py-2 px-3 rounded bg-transparent border"
            style={{ borderColor: "var(--border)", minHeight: 120 }}
          />
        </Section>

        <Section title="Context">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={intake.jurisdiction ?? ""}
              onChange={(e) => update("jurisdiction", e.target.value)}
              placeholder="Jurisdiction"
              className="text-sm py-1 px-2 rounded bg-transparent border"
              style={{ borderColor: "var(--border)" }}
            />
            <input
              value={intake.intakeTypeHint ?? ""}
              onChange={(e) => update("intakeTypeHint", e.target.value)}
              placeholder="Claim hint (e.g. FDCPA violation)"
              className="text-sm py-1 px-2 rounded bg-transparent border"
              style={{ borderColor: "var(--border)" }}
            />
          </div>
        </Section>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Saving..." : "Save intake"}
          </button>
          {savedAt && <span className="text-xs" style={{ color: "var(--success)" }}>Saved at {savedAt}</span>}
          {err && <span className="text-xs" style={{ color: "var(--danger)" }}>{err}</span>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>{title}</div>
      {children}
    </div>
  );
}
