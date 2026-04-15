import { NextRequest, NextResponse } from "next/server";
import { ingestPDF } from "@/lib/ingest";
import { vectorStore } from "@/lib/vector-store";
import { buildGraph, saveGraph } from "@/lib/graph";
import { DEFAULT_MATTER_ID } from "@/lib/config";
import { getMatter } from "@/lib/matters";
import { DOC_TYPES, type DocType } from "@/lib/retrieval-filter";
import { classifyDocument, extractHeadText, type ClassificationResult } from "@/lib/doc-classifier";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.name.toLowerCase().endsWith(".pdf"))
      return NextResponse.json({ error: "Please upload a PDF file" }, { status: 400 });

    // Resolve matterId through the matter index so we never accept arbitrary
    // strings that would let `matterPaths()` write outside the corpus tree.
    // Unknown ids fail closed with 404 — the only admitted values are the
    // legacy `default` matter and ids present in matters-index.json.
    const rawMatterId = formData.get("matterId");
    const requestedMatterId =
      typeof rawMatterId === "string" && rawMatterId.length > 0 ? rawMatterId : DEFAULT_MATTER_ID;
    const matter = await getMatter(requestedMatterId);
    if (!matter) {
      return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    }
    const matterId = matter.id;
    const rawDocType = formData.get("docType");
    const userDocType: DocType | null = DOC_TYPES.includes(rawDocType as DocType)
      ? (rawDocType as DocType)
      : null;
    const rawJurisdiction = formData.get("jurisdiction");
    const jurisdiction = typeof rawJurisdiction === "string" && rawJurisdiction.trim().length > 0 ? rawJurisdiction.trim() : null;

    const buffer = Buffer.from(await file.arrayBuffer());

    let docType: DocType = userDocType ?? "unknown";
    let classification: ClassificationResult | null = null;
    if (!userDocType || userDocType === "unknown") {
      const headText = await extractHeadText(buffer);
      classification = await classifyDocument({ fileName: file.name, headText });
      docType = classification.docType;
    }

    const result = await ingestPDF(buffer, file.name, { matterId, docType, jurisdiction });
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
      matterId,
      docType,
      classification,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message || "Failed to process document" }, { status: 500 });
  }
}
