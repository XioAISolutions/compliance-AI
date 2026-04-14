import { NextRequest, NextResponse } from "next/server";
import { loadAllChunks } from "@/lib/ingest";
import { vectorStore } from "@/lib/vector-store";

export async function GET(req: NextRequest) {
  const chunkId = req.nextUrl.searchParams.get("chunkId");
  if (chunkId) {
    const allChunks = await loadAllChunks();
    const chunk = allChunks.find((c) => c.id === chunkId);
    if (!chunk) return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    return NextResponse.json({ chunk });
  }
  const documents = await vectorStore.listDocuments();
  const totalChunks = await vectorStore.count();
  return NextResponse.json({ documents, totalChunks });
}
