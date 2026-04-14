import { NextRequest, NextResponse } from "next/server";
import { getMatter } from "@/lib/matters";
import { listTriageRuns, triageMatter } from "@/lib/triage";

/**
 * GET  /api/matters/[id]/triage           — list prior triage runs.
 * POST /api/matters/[id]/triage           — run triage. Body: { judge?: boolean | "weak" }.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  const runs = await listTriageRuns(id);
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const matter = await getMatter(id);
    if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const judge: boolean | "weak" =
      body?.judge === true ? true : body?.judge === "weak" ? "weak" : false;
    const maxCandidates = typeof body?.maxCandidates === "number" ? body.maxCandidates : undefined;
    const authorityBoost = body?.authorityBoost === true;
    const result = await triageMatter(id, { judge, maxCandidates, authorityBoost });
    return NextResponse.json({ result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Triage failed" }, { status: 500 });
  }
}
