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
import { getDefaultAuditStore, sha256 } from "../../../lib/audit-store";
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

/**
 * Bulk delete by source — DELETE /api/authorities?source=<filename>
 *
 * Removes every cognition item whose `source` field begins with the given
 * filename + " (". Scoped to the caller's organizationId so a tenant can
 * never wipe another tenant's items. Baseline-seeded authorities (source
 * not derived from an upload) are never matched by the filename regex so
 * they're safe from bulk deletion — a lawyer needs the per-id DELETE
 * endpoint to touch those.
 *
 * Returns the count of items removed. Useful for undoing a mistaken
 * upload where chunkCount is ~70 and deleting one by one would be
 * tedious.
 */
export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = session.organizationId;

  const source = req.nextUrl.searchParams.get("source");
  if (!source || !source.trim()) {
    return NextResponse.json({ error: "Missing ?source=<filename> query param" }, { status: 400 });
  }

  const store = getDefaultCognitionStore("securities");
  const all = await store.getAll();
  // Exact-prefix match on the source filename + " (" guard so a partial
  // overlap (e.g. "NI.pdf" wouldn't match "NI 45-106.pdf") can't wipe
  // unrelated items.
  const prefix = `${source.trim()} (`;
  const targets = all.filter(
    (item) => item.organizationId === organizationId && item.source?.startsWith(prefix),
  );
  if (targets.length === 0) {
    return NextResponse.json({ removed: 0, source });
  }

  let removedCount = 0;
  for (const item of targets) {
    if (!item.id) continue;
    const ok = await store.remove(item.id);
    if (ok) removedCount += 1;
  }

  const auditStore = getDefaultAuditStore();
  await auditStore.append(`authority-bulkdelete-${sha256(source).slice(0, 12)}`, {
    matterId: `authority-bulkdelete-${sha256(source).slice(0, 12)}`,
    organizationId,
    actor: session.user.email,
    action: "retrieval",
    inputHash: sha256(source),
    authoritiesUsed: targets.map((t) => t.id!).filter(Boolean),
    outputHash: null,
    judgeVerdict: null,
    inputContent: `Bulk authority deletion: source="${source}"`,
    outputContent: `Removed ${removedCount} of ${targets.length} matched chunks from ${organizationId}'s securities corpus.`,
  });

  return NextResponse.json({ removed: removedCount, source });
}
