import { NextRequest, NextResponse } from "next/server";
import { vectorStore } from "@/lib/vector-store";
import { getContext, getGraphStats } from "@/lib/graph";
import type { RetrievalFilter } from "@/lib/retrieval-filter";

export async function GET(req: NextRequest) {
  const chunkId = req.nextUrl.searchParams.get("chunkId");
  if (chunkId) {
    const ctx = await getContext(chunkId);
    if (!ctx) return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    return NextResponse.json(ctx);
  }
  const matterId = req.nextUrl.searchParams.get("matterId");
  const filter: RetrievalFilter | undefined = matterId ? { matterIds: [matterId] } : undefined;
  const [documents, totalChunks, graphStats] = await Promise.all([
    vectorStore.listDocuments(filter),
    vectorStore.count(filter),
    getGraphStats(),
  ]);
  return NextResponse.json({ documents, totalChunks, graphStats });
}
