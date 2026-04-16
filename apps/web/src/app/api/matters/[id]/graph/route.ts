import { NextResponse } from "next/server";
import { buildEvidenceGraph } from "../../../../../lib/matter-context";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getDefaultMatterStore().get(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }
  return NextResponse.json(await buildEvidenceGraph(id));
}
