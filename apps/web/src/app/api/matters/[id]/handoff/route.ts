import { NextResponse } from "next/server";
import { buildMatterContextBundle, renderCrumbHandoff } from "../../../../../lib/matter-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bundle = await buildMatterContextBundle(id);
  if (!bundle) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  return new Response(renderCrumbHandoff(bundle), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}-handoff.crumb"`,
    },
  });
}
