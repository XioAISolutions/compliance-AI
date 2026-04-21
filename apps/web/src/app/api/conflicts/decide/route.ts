/**
 * POST /api/conflicts/decide
 *
 * Records a partner's decision on a pending conflict-check (cleared
 * or declined). Only `pending` checks can be transitioned. Cleared
 * checks unblock matter creation; declined checks are the firm's
 * audit record that they refused the engagement.
 *
 * Request body:
 *   { id, decision: "cleared" | "declined", decidedBy, rationale? }
 *
 * Response: the updated ConflictCheck row.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultConflictStore } from "../../../../lib/conflict-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DecideBody {
  id: string;
  decision: "cleared" | "declined";
  decidedBy: string;
  rationale?: string;
}

export async function POST(req: NextRequest) {
  let body: DecideBody;
  try {
    body = (await req.json()) as DecideBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "`id` is required" }, { status: 400 });
  }
  if (body.decision !== "cleared" && body.decision !== "declined") {
    return NextResponse.json(
      { error: "`decision` must be 'cleared' or 'declined'" },
      { status: 400 },
    );
  }
  if (!body.decidedBy || typeof body.decidedBy !== "string") {
    return NextResponse.json({ error: "`decidedBy` is required" }, { status: 400 });
  }
  // Cleared decisions on hits + every declined decision require a
  // rationale. The conflict store enforces "terminal states are
  // immutable" so this is the one chance the partner has to record
  // why.
  if (!body.rationale || body.rationale.trim().length < 5) {
    return NextResponse.json(
      { error: "`rationale` (at least 5 characters) is required" },
      { status: 400 },
    );
  }

  const store = getDefaultConflictStore();
  const result = await store.decide({
    id: body.id,
    decision: body.decision,
    decidedBy: body.decidedBy,
    rationale: body.rationale,
  });

  if (!result) {
    return NextResponse.json({ error: "conflict check not found" }, { status: 404 });
  }
  if (result.decision !== body.decision) {
    return NextResponse.json(
      { error: `conflict check is in terminal state '${result.decision}', cannot transition` },
      { status: 409 },
    );
  }
  return NextResponse.json(result);
}
