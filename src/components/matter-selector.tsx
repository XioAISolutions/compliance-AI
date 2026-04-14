"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface MatterSummary {
  id: string;
  slug: string;
  displayName: string;
  persona: "plaintiff" | "compliance_ops" | "legal_aid" | "in_house";
  jurisdiction?: string;
  isLibrary?: boolean;
}

const PERSONAS: { id: MatterSummary["persona"]; label: string }[] = [
  { id: "plaintiff", label: "Plaintiff" },
  { id: "compliance_ops", label: "Compliance ops" },
  { id: "legal_aid", label: "Legal aid" },
  { id: "in_house", label: "In-house" },
];

export function MatterSelector({
  matters,
  activeId,
  onCreated,
}: {
  matters: MatterSummary[];
  activeId?: string;
  onCreated?: (matter: MatterSummary) => void;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [persona, setPersona] = useState<MatterSummary["persona"]>("plaintiff");
  const [jurisdiction, setJurisdiction] = useState("");
  const [isLibrary, setIsLibrary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const libraries = matters.filter((m) => m.isLibrary);
  const workingMatters = matters.filter((m) => !m.isLibrary);

  async function create() {
    if (!displayName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, persona, jurisdiction: jurisdiction || undefined, isLibrary }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Create failed");
      }
      const { matter } = await r.json();
      onCreated?.(matter);
      setCreating(false);
      setDisplayName("");
      setJurisdiction("");
      setIsLibrary(false);
      router.push(`/matter/${matter.id}`);
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Matters</span>
        <button
          onClick={() => setCreating(!creating)}
          className="px-2 py-1 rounded-md text-xs border"
          style={{ background: creating ? "var(--accent-dim)" : "transparent", borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          {creating ? "Cancel" : "+ New"}
        </button>
      </div>

      {creating && (
        <div className="mb-2 p-2 rounded-md border" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Matter name (e.g. Smith v. Collector)"
            className="w-full bg-transparent text-sm py-1 px-2 rounded border mb-1"
            style={{ borderColor: "var(--border)" }}
          />
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value as MatterSummary["persona"])}
            className="w-full bg-transparent text-sm py-1 px-2 rounded border mb-1"
            style={{ borderColor: "var(--border)" }}
          >
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <input
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="Jurisdiction (optional)"
            className="w-full bg-transparent text-sm py-1 px-2 rounded border mb-1"
            style={{ borderColor: "var(--border)" }}
          />
          <label className="flex items-center gap-2 text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={isLibrary} onChange={(e) => setIsLibrary(e.target.checked)} />
            Statute library (shareable across matters)
          </label>
          {err && <div className="text-xs mb-1" style={{ color: "var(--danger)" }}>{err}</div>}
          <button
            onClick={create}
            disabled={busy || !displayName.trim()}
            className="w-full px-2 py-1 rounded-md text-xs border"
            style={{
              background: !displayName.trim() ? "var(--bg-primary)" : "var(--accent)",
              borderColor: "var(--accent)",
              color: !displayName.trim() ? "var(--text-muted)" : "#fff",
            }}
          >
            {busy ? "Creating..." : "Create matter"}
          </button>
        </div>
      )}

      {workingMatters.length > 0 && (
        <div className="mb-2">
          {workingMatters.map((m) => (
            <MatterRow key={m.id} matter={m} active={m.id === activeId} onOpen={() => router.push(`/matter/${m.id}`)} />
          ))}
        </div>
      )}

      {libraries.length > 0 && (
        <>
          <div className="text-xs uppercase tracking-wider mt-3 mb-1" style={{ color: "var(--text-muted)" }}>Libraries</div>
          {libraries.map((m) => (
            <MatterRow key={m.id} matter={m} active={m.id === activeId} onOpen={() => router.push(`/matter/${m.id}`)} />
          ))}
        </>
      )}
    </div>
  );
}

function MatterRow({ matter, active, onOpen }: { matter: MatterSummary; active: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full flex flex-col items-start px-2 py-1.5 mb-1 rounded-md border text-left"
      style={{
        background: active ? "#1e3a5f" : "var(--bg-card)",
        borderColor: active ? "var(--accent)" : "var(--border)",
      }}
    >
      <span className="text-sm font-medium truncate w-full">{matter.displayName}</span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {matter.persona.replace("_", " ")}{matter.jurisdiction ? ` · ${matter.jurisdiction}` : ""}
      </span>
    </button>
  );
}
