/**
 * GET  /api/matters/[id]/transcript        → JSON timeline
 * GET  /api/matters/[id]/transcript?fmt=jsonl → raw JSONL (download)
 *
 * Per-matter timeline of agent + user turns, used by the Timeline tab in
 * the Output pane. JSONL export is the format a human reviewer can diff
 * / replay.
 */

import { NextRequest } from "next/server";
import { getDefaultTranscriptStore } from "@compliance-ai/chat-structure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fmt = req.nextUrl.searchParams.get("fmt");
  const store = getDefaultTranscriptStore();

  if (fmt === "jsonl") {
    const jsonl = store.toJsonl(id);
    return new Response(jsonl, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="matter-${id}-transcript.jsonl"`,
      },
    });
  }

  const turns = store.getByMatter(id);
  return new Response(JSON.stringify({ turns }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  getDefaultTranscriptStore().clear(id);
  return new Response(null, { status: 204 });
}
