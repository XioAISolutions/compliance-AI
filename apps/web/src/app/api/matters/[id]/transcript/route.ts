import { NextRequest, NextResponse } from "next/server";
import { getDefaultTranscriptStore, toJsonl } from "@compliance-ai/chat-structure";
import { buildTranscriptEvents, transcriptJsonl } from "../../../../../lib/matter-context";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getDefaultMatterStore().get(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const turns = getDefaultTranscriptStore().getByMatter(id);
  const events = await buildTranscriptEvents(id);
  const format = req.nextUrl.searchParams.get("fmt");

  if (format === "jsonl") {
    const shape = req.nextUrl.searchParams.get("shape");
    const body =
      shape === "events"
        ? transcriptJsonl(events)
        : turns.length > 0
          ? `${toJsonl(turns)}\n`
          : transcriptJsonl(events);

    return new Response(body, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="${id}-transcript.jsonl"`,
      },
    });
  }

  return NextResponse.json({ turns, events });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  getDefaultTranscriptStore().clear(id);
  return new Response(null, { status: 204 });
}
