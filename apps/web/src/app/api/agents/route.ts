import { NextResponse } from "next/server";
import {
  AGENT_REGISTRY,
  MAX_AGENT_HOPS,
  PARTICIPANTS,
  toStatusView,
} from "@compliance-ai/chat-structure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    participants: Object.values(PARTICIPANTS),
    statusView: toStatusView(),
    maxHops: MAX_AGENT_HOPS,
    agents: AGENT_REGISTRY,
  });
}
