import { NextRequest, NextResponse } from "next/server";
import { ingestPDF } from "@/lib/ingest";
import { vectorStore } from "@/lib/vector-store";
import { buildGraph, saveGraph } from "@/lib/graph";
import { getMatter } from "@/lib/matters";
import { DOC_TYPES, type DocType } from "@/lib/retrieval-filter";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const matter = await getMatter(id);
    if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.name.toLowerCase().endsWith(".pdf"))
      return NextResponse.json({ error: "Please upload a PDF file" }, { status: 400 });

    const rawDocType = formData.get("docType");
    const docType: DocType = DOC_TYPES.includes(rawDocType as DocType) ? (rawDocType as DocType) : "unknown";
    const rawJurisdiction = formData.get("jurisdiction");
    const jurisdiction =
      typeof rawJurisdiction === "string" && rawJurisdiction.trim().length > 0
        ? rawJurisdiction.trim()
        : matter.jurisdiction ?? null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestPDF(buffer, file.name, { matterId: id, docType, jurisdiction });
    await vectorStore.indexChunks(result.chunks);
    await vectorStore.refresh();
    await saveGraph(await buildGraph());

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      fileName: result.fileName,
      totalPages: result.totalPages,
      totalChunks: result.totalChunks,
      totalSections: result.sections.length,
      docType,
    });
  } catch (err: any) {
    console.error("Matter upload error:", err);
    return NextResponse.json({ error: err.message || "Failed to process document" }, { status: 500 });
  }
}
