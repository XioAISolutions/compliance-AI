"use client";
import { useEffect, useState } from "react";
import { Chat } from "./chat";
import { MatterSelector, type MatterSummary } from "./matter-selector";

/**
 * Root page. Shows the matter selector alongside the legacy default-corpus
 * chat so existing users land on something familiar. Clicking a matter
 * navigates to `/matter/[id]`.
 */
export function HomeClient() {
  const [matters, setMatters] = useState<MatterSummary[]>([]);

  async function refresh() {
    try {
      const r = await fetch("/api/matters");
      if (r.ok) {
        const d = await r.json();
        setMatters(d.matters || []);
      }
    } catch {}
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="flex h-screen">
      <div className="flex flex-col border-r overflow-auto" style={{ width: 280, borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <MatterSelector matters={matters} activeId="default" onCreated={refresh} />
      </div>
      <div className="flex-1 min-w-0">
        <Chat />
      </div>
    </div>
  );
}
