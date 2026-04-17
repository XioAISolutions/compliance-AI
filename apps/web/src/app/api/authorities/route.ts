/**
 * Authority corpus snapshot — GET /api/authorities
 *
 * Returns a summary of what's in the tenant's cognition corpus: total item
 * count, a breakdown by jurisdiction + registrationCategory, and the most
 * recently added authorities (so the user can see their intakes landed).
 *
 * Motivation: after the authority-intake path in /api/quick-review started
 * adding regulation uploads to the cognition store, the only way to verify
 * the intake worked was the healthcheck's `securitiesSize` counter. That
 * counter doesn't tell a compliance lawyer WHICH authorities are available
 * to the reviewer on their next OM upload. This endpoint does.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultCognitionStore } from "@compliance-ai/cognition";
import { ensureTenant } from "../../../lib/bootstrap";
import { requireSession } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuthoritySnippetSummary {
  id: string;
  title: string;
  source: string | null;
  jurisdiction: string | null;
  registrationCategories: string[];
  contentLength: number;
  createdAt: string | null;
}

export async function GET(_req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = session.organizationId;
  await ensureTenant(organizationId);

  const store = getDefaultCognitionStore("securities");
  const all = await store.getAll();
  const scoped = all.filter((item) => item.organizationId === organizationId);

  // Breakdown by jurisdiction — helps a lawyer see whether they've ingested
  // the cross-jurisdictional material they'd want (e.g. Ontario, Quebec, BC).
  const byJurisdiction: Record<string, number> = {};
  const byRegistrationCategory: Record<string, number> = {};
  for (const item of scoped) {
    const j = item.jurisdiction ?? "unspecified";
    byJurisdiction[j] = (byJurisdiction[j] ?? 0) + 1;
    for (const rc of item.registrationCategories ?? ["unspecified"]) {
      byRegistrationCategory[rc] = (byRegistrationCategory[rc] ?? 0) + 1;
    }
  }

  // Most-recent-N summaries for a compact "recent intakes" display. Sorted
  // by createdAt descending; items without timestamps bubble to the bottom.
  const sorted = [...scoped].sort((a, b) => {
    const aTs = a.createdAt?.getTime() ?? 0;
    const bTs = b.createdAt?.getTime() ?? 0;
    return bTs - aTs;
  });
  const recent: AuthoritySnippetSummary[] = sorted.slice(0, 20).map((item) => ({
    id: item.id ?? "",
    title: item.title,
    source: item.source ?? null,
    jurisdiction: item.jurisdiction ?? null,
    registrationCategories: item.registrationCategories ?? [],
    contentLength: item.content.length,
    createdAt: item.createdAt?.toISOString() ?? null,
  }));

  // Count UNIQUE upload sessions by extracting the filename from the source
  // string — our authority-intake emits `source: "<file.pdf> (authority-rule, uploaded YYYY-MM-DD)"`.
  const uploadedFiles = new Set<string>();
  for (const item of scoped) {
    const match = item.source?.match(/^([^()]+?)\s*\(/);
    if (match?.[1]) uploadedFiles.add(match[1].trim());
  }

  return NextResponse.json({
    organizationId,
    surface: "securities",
    total: scoped.length,
    byJurisdiction,
    byRegistrationCategory,
    uploadedSources: Array.from(uploadedFiles).sort(),
    recent,
  });
}
