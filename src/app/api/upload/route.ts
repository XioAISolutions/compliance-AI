import { NextRequest, NextResponse } from "next/server";
import { ingestPDF } from "@/lib/ingest";
import { vectorStore } from "@/lib/vector-store";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.name.toLowerCase().endsWith(".pdf"))
      return NextResponse.json({ error: "Please upload a PDF file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestPDF(buffer, file.name);
    await vectorStore.indexChunks(result.chunks);

    return NextResponse.json({
      success: true, documentId: result.documentId, fileName: result.fileName,
      totalPages: result.totalPages, totalChunks: result.totalChunks,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message || "Failed to process document" }, { status: 500 });
  }
}
