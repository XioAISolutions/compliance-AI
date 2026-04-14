"use client";
export function CitationBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 90 ? "var(--success)" : pct >= 75 ? "var(--warning)" : "var(--danger)";
  return <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}15`, padding: "2px 6px", borderRadius: 4 }}>{pct}%</span>;
}
