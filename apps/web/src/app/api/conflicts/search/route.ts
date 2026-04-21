/**
 * POST /api/conflicts/search
 *
 * Runs a conflict-of-interest screen against the firm's existing
 * matters and creates a `conflict_checks` row recording the result.
 *
 * No-hits searches land already-`cleared` (the absence of conflicts
 * is provable from the audit chain). Searches with hits land
 * `pending` and require a partner decision via /api/conflicts/decide
 * before the matter can be created.
 *
 * Request body:
 *   { clientName, opposingParty?, scope?, searchedBy }
 *
 * Response body:
 *   { check: ConflictCheck, hits: [{ id, title, clientName, opposingParty, status }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultMatterStore } from "../../../../lib/matter-store";
import { getDefaultConflictStore, findConflictHits } from "../../../../lib/conflict-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SearchBody {
  clientName: string;
  opposingParty?: string;
  scope?: string;
  searchedBy: string;
  organizationId?: string;
}

export async function POST(req: NextRequest) {
  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.clientName || typeof body.clientName !== "string") {
    return NextResponse.json({ error: "`clientName` is required" }, { status: 400 });
  }
  if (!body.searchedBy || typeof body.searchedBy !== "string") {
    return NextResponse.json({ error: "`searchedBy` is required" }, { status: 400 });
  }

  const organizationId = body.organizationId ?? "preview";

  const matterStore = getDefaultMatterStore();
  const conflictStore = getDefaultConflictStore();

  // Pull the candidate set first. In Postgres mode this returns
  // tenant-scoped rows via the matter store's existing org filter.
  const allMatters = await matterStore.list(organizationId);
  const hitIds = findConflictHits(allMatters, {
    clientName: body.clientName,
    ...(body.opposingParty !== undefined ? { opposingParty: body.opposingParty } : {}),
    organizationId,
  });

  const check = await conflictStore.create(
    {
      clientName: body.clientName,
      ...(body.opposingParty !== undefined ? { opposingParty: body.opposingParty } : {}),
      ...(body.scope !== undefined ? { scope: body.scope } : {}),
      hitMatterIds: hitIds,
      searchedBy: body.searchedBy,
    },
    organizationId,
  );

  // Hydrate the hit matter ids into a UI-friendly shape so the wizard
  // doesn't have to re-fetch each one. Keep the shape minimal.
  const hitMattersById = new Map(allMatters.map((m) => [m.id, m]));
  const hits = hitIds.map((id) => {
    const m = hitMattersById.get(id);
    return {
      id,
      title: m?.title ?? "(unknown matter)",
      clientName: m?.clientName ?? null,
      opposingParty: m?.opposingParty ?? null,
      status: m?.status ?? null,
    };
  });

  return NextResponse.json({ check, hits });
}
