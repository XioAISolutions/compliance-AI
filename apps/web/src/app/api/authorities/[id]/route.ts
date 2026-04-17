/**
 * Authority item management — DELETE /api/authorities/[id]
 *
 * Removes a single cognition item from the tenant's securities corpus.
 * Scoped to the caller's organizationId so a tenant can never delete
 * another tenant's items (defense in depth — the in-memory store doesn't
 * yet enforce RLS but the route layer does).
 *
 * Typical use: a lawyer accidentally uploads the wrong document (e.g.
 * an outdated consolidation or an irrelevant staff notice) and wants to
 * prune it before the next review cites it.
 *
 * We intentionally don't support bulk-delete by source filename here —
 * that's a corpus-management feature that belongs in its own route with
 * its own confirm step. This route is for targeted removals.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultCognitionStore } from "@compliance-ai/cognition";
import { getDefaultAuditStore, sha256 } from "../../../../lib/audit-store";
import { requireSession } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = session.organizationId;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const store = getDefaultCognitionStore("securities");
  const item = await store.get(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Tenant-scope guard: refuse to delete items owned by a different
  // organization. Without this, a misconfigured client could wipe the
  // baseline seed or other tenants' uploads.
  if (item.organizationId && item.organizationId !== organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ok = await store.remove(id);
  if (!ok) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  // Audit: corpus deletions are as auditor-relevant as intakes. We log
  // under the same `authority-*` key prefix we used for the original
  // intake so the full lifecycle reads linearly.
  const auditStore = getDefaultAuditStore();
  await auditStore.append(`authority-delete-${id.slice(0, 12)}`, {
    matterId: `authority-delete-${id.slice(0, 12)}`,
    organizationId,
    actor: session.user.email,
    action: "retrieval",
    inputHash: sha256(id),
    authoritiesUsed: [id],
    outputHash: null,
    judgeVerdict: null,
    inputContent: `Authority deletion: ${item.title} (id=${id})`,
    outputContent: `Removed from ${organizationId}'s securities corpus.`,
  });

  return NextResponse.json({
    ok: true,
    removed: { id, title: item.title },
  });
}
