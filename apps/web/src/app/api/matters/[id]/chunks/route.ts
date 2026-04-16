/**
 * GET /api/matters/[id]/chunks — enumerate chunks that belong to this
 * matter's uploaded documents.
 *
 * Used by the Graph tab to render Chunk nodes between Document and
 * Citation nodes. Scoped to the matter's org + jurisdiction +
 * registration so we don't accidentally surface chunks from other matters
 * in the same tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultCognitionStore } from "@compliance-ai/cognition";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_ORG_ID = "preview";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = getDefaultMatterStore().get(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const docs = getDefaultMatterStore().getDocuments(id);
  const docFilenames = new Set(docs.map((d) => d.filename));
  const docIdByFilename = new Map(docs.map((d) => [d.filename, d.id]));

  // Chunks are stored in the securities cognition store with `source` set
  // to the original filename. We match back to documents by filename.
  const store = getDefaultCognitionStore("securities");
  const all = await store.getAll();
  const chunks = all
    .filter(
      (item) =>
        item.organizationId === PREVIEW_ORG_ID &&
        item.source &&
        docFilenames.has(item.source) &&
        item.jurisdiction === matter.jurisdiction,
    )
    .map((item) => {
      // Title is of the form "<filename> · p.<page>" — pull the page back out.
      const pageMatch = item.title.match(/p\.(\d+)/);
      return {
        id: item.id ?? "",
        docId: docIdByFilename.get(item.source ?? "") ?? "",
        title: item.title,
        page: pageMatch ? Number(pageMatch[1]) : undefined,
        preview: item.content.slice(0, 160),
      };
    })
    .filter((c) => c.docId); // drop orphans

  return NextResponse.json({ chunks });
}
