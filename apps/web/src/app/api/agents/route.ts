/**
 * GET /api/agents — returns the registered participants (agents + user).
 *
 * Used by the Timeline UI to render colored pills + descriptions without
 * hard-coding the list in multiple places.
 */

import { NextResponse } from "next/server";
import { PARTICIPANTS, toStatusView } from "@compliance-ai/chat-structure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  // Status is synthesized from the static defaults here — a future
  // enhancement can track live status per session.
  return NextResponse.json({
    participants: Object.values(PARTICIPANTS),
    statusView: toStatusView(),
  });
}
