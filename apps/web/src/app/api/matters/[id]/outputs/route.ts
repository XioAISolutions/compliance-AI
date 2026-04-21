/**
 * GET /api/matters/[id]/outputs
 *
 * Lists prior completed-review snapshots (version-numbered, newest
 * first) so the matter page's "Compare to v1 / v2 / …" toggle can
 * offer a choice.
 *
 * ?compare=<versionNo>[&to=<versionNo>] produces the word-level
 * redline markup between the chosen prior version and (by default)
 * the latest version, in the same [-deleted-]{+inserted+} token
 * syntax RedlinePreview already knows how to render.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";
import { getDefaultOutputSnapshotStore } from "../../../../../lib/output-snapshot-store";
import { diffOutputs } from "../../../../../lib/output-diff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const matter = await getDefaultMatterStore().get(matterId);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const store = getDefaultOutputSnapshotStore();
  const snapshots = await store.list(matterId);
  const url = new URL(req.url);
  const compareRaw = url.searchParams.get("compare");
  const toRaw = url.searchParams.get("to");

  if (!compareRaw) {
    // Summary list — content omitted to keep payloads small; a
    // client that actually needs a full version calls ?compare=<n>.
    return NextResponse.json({
      count: snapshots.length,
      latest: snapshots[snapshots.length - 1]?.versionNo ?? null,
      versions: snapshots.map((s) => ({
        id: s.id,
        versionNo: s.versionNo,
        createdAt: s.createdAt,
        createdBy: s.createdBy,
        chars: s.content.length,
        citationCount: Array.isArray(s.citations) ? s.citations.length : 0,
      })),
    });
  }

  const fromVersion = Number.parseInt(compareRaw, 10);
  if (!Number.isFinite(fromVersion) || fromVersion < 1) {
    return NextResponse.json(
      { error: "`compare` must be a positive version number" },
      { status: 400 },
    );
  }

  const latest = snapshots[snapshots.length - 1];
  const toVersion = toRaw ? Number.parseInt(toRaw, 10) : latest?.versionNo ?? fromVersion;
  if (!Number.isFinite(toVersion) || toVersion < 1) {
    return NextResponse.json(
      { error: "`to` must be a positive version number" },
      { status: 400 },
    );
  }

  const from = await store.get(matterId, fromVersion);
  const to = await store.get(matterId, toVersion);
  if (!from) {
    return NextResponse.json(
      { error: `version ${fromVersion} not found` },
      { status: 404 },
    );
  }
  if (!to) {
    return NextResponse.json(
      { error: `version ${toVersion} not found` },
      { status: 404 },
    );
  }

  const result = diffOutputs(from.content, to.content);
  return NextResponse.json({
    from: { versionNo: from.versionNo, createdAt: from.createdAt, createdBy: from.createdBy },
    to: { versionNo: to.versionNo, createdAt: to.createdAt, createdBy: to.createdBy },
    markup: result.markup,
    stats: result.stats,
  });
}
