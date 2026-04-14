import { NextRequest, NextResponse } from "next/server";
import { getMatter } from "@/lib/matters";
import { loadIntake, saveIntake, emptyIntake } from "@/lib/intake";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  const intake = (await loadIntake(id)) ?? emptyIntake(id);
  return NextResponse.json({ intake });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const matter = await getMatter(id);
    if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    const body = await req.json();
    const intake = await saveIntake(id, {
      parties: Array.isArray(body.parties) ? body.parties : undefined,
      timeline: Array.isArray(body.timeline) ? body.timeline : undefined,
      freeNarrative: typeof body.freeNarrative === "string" ? body.freeNarrative : undefined,
      jurisdiction: typeof body.jurisdiction === "string" ? body.jurisdiction : undefined,
      intakeTypeHint: typeof body.intakeTypeHint === "string" ? body.intakeTypeHint : undefined,
    });
    return NextResponse.json({ intake });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save intake" }, { status: 500 });
  }
}
