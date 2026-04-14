import { NextRequest, NextResponse } from "next/server";
import { vectorStore } from "@/lib/vector-store";
import { getContext } from "@/lib/graph";

export async function GET(req: NextRequest) {
  const chunkId = req.nextUrl.searchParams.get("chunkId");
  if (chunkId) {
    const ctx = await getContext(chunkId);
    if (!ctx) return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    return NextResponse.json(ctx);
  }
  const documents = await vectorStore.listDocuments();
  const totalChunks = await vectorStore.count();
  return NextResponse.json({ documents, totalChunks });
}
