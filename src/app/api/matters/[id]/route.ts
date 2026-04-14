import { NextRequest, NextResponse } from "next/server";
import { getMatter, updateMatter, type MatterPersona } from "@/lib/matters";
import { vectorStore } from "@/lib/vector-store";

const VALID_PERSONAS: MatterPersona[] = ["plaintiff", "compliance_ops", "legal_aid", "in_house"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  const [documents, chunkCount] = await Promise.all([
    vectorStore.listDocuments({ matterIds: [id] }),
    vectorStore.count({ matterIds: [id] }),
  ]);
  return NextResponse.json({ matter, documents, chunkCount });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: Parameters<typeof updateMatter>[1] = {};
    if (typeof body.displayName === "string") patch.displayName = body.displayName;
    if (typeof body.persona === "string" && VALID_PERSONAS.includes(body.persona as MatterPersona)) patch.persona = body.persona as MatterPersona;
    if (typeof body.jurisdiction === "string" || body.jurisdiction === null) patch.jurisdiction = body.jurisdiction ?? undefined;
    if (Array.isArray(body.statuteCorpusIds)) patch.statuteCorpusIds = body.statuteCorpusIds.filter((s: unknown) => typeof s === "string");
    if (typeof body.notes === "string") patch.notes = body.notes;
    const matter = await updateMatter(id, patch);
    return NextResponse.json({ matter });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update matter" }, { status: 500 });
  }
}
