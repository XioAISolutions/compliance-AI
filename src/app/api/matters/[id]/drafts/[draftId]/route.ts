import { NextRequest, NextResponse } from "next/server";
import { exportDraftMarkdown, loadDraft } from "@/lib/drafting";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; draftId: string }> }) {
  const { id, draftId } = await params;
  const draft = await loadDraft(id, draftId);
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format");
  if (format === "markdown") {
    const md = exportDraftMarkdown(draft);
    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${draft.displayName.replace(/\s+/g, "-").toLowerCase()}-${draft.id.slice(0, 8)}.md"`,
      },
    });
  }

  return NextResponse.json({ draft });
}
