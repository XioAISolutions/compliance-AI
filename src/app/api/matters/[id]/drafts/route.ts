import { NextRequest, NextResponse } from "next/server";
import { getMatter } from "@/lib/matters";
import { generateDraft, listDrafts, saveDraft, DRAFT_TEMPLATES, type DraftKind } from "@/lib/drafting";

const VALID_KINDS: DraftKind[] = ["demand_letter", "complaint", "internal_memo", "response_to_regulator"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  const drafts = await listDrafts(id);
  const availableKinds = VALID_KINDS.filter((k) => DRAFT_TEMPLATES[k] !== null);
  return NextResponse.json({ drafts, availableKinds });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const matter = await getMatter(id);
    if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
    const body = await req.json();
    const rawKind: string | undefined = body.kind;
    if (!rawKind || !VALID_KINDS.includes(rawKind as DraftKind))
      return NextResponse.json({ error: `kind must be one of ${VALID_KINDS.join(", ")}` }, { status: 400 });
    if (!DRAFT_TEMPLATES[rawKind as DraftKind])
      return NextResponse.json({ error: `Draft kind '${rawKind}' is not available in this build` }, { status: 400 });

    const judge: boolean | "weak" =
      body.judge === true ? true : body.judge === "weak" ? "weak" : false;
    const authorityBoost = body.authorityBoost === true;

    const draft = await generateDraft(id, rawKind as DraftKind, {
      judge,
      filterOverrides: authorityBoost ? { authorityBoost: true } : undefined,
    });
    await saveDraft(draft);
    return NextResponse.json({ draft });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate draft" }, { status: 500 });
  }
}
