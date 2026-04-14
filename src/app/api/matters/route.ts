import { NextRequest, NextResponse } from "next/server";
import { listMatters, createMatter, type MatterPersona } from "@/lib/matters";

const VALID_PERSONAS: MatterPersona[] = ["plaintiff", "compliance_ops", "legal_aid", "in_house"];

export async function GET() {
  const matters = await listMatters();
  return NextResponse.json({ matters });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const displayName: string | undefined = body.displayName;
    const rawPersona: string | undefined = body.persona;
    if (!displayName?.trim())
      return NextResponse.json({ error: "displayName is required" }, { status: 400 });
    if (!rawPersona || !VALID_PERSONAS.includes(rawPersona as MatterPersona))
      return NextResponse.json({ error: `persona must be one of ${VALID_PERSONAS.join(", ")}` }, { status: 400 });

    const matter = await createMatter({
      displayName,
      persona: rawPersona as MatterPersona,
      jurisdiction: typeof body.jurisdiction === "string" ? body.jurisdiction : undefined,
      statuteCorpusIds: Array.isArray(body.statuteCorpusIds) ? body.statuteCorpusIds.filter((s: unknown) => typeof s === "string") : [],
      notes: typeof body.notes === "string" ? body.notes : undefined,
      isLibrary: body.isLibrary === true,
    });
    return NextResponse.json({ matter });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create matter" }, { status: 500 });
  }
}
