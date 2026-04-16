/**
 * Evidence API — GET (list) + POST (create evidence item).
 *
 * Evidence items are the per-matter artifacts the reviewer identifies as
 * missing or partial. GET lists all items for the matter; POST creates a
 * new item (manually or from an auto-extract trigger).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getDefaultEvidenceStore,
  type CreateEvidenceInput,
  type EvidenceStatus,
} from "../../../../../lib/evidence-store";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.get(matterId);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const store = getDefaultEvidenceStore();
  const items = await store.list(matterId);
  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.get(matterId);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  let body: Partial<CreateEvidenceInput>;
  try {
    body = (await req.json()) as Partial<CreateEvidenceInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || !body.description) {
    return NextResponse.json(
      { error: "title and description are required" },
      { status: 400 },
    );
  }

  const store = getDefaultEvidenceStore();
  const item = await store.create(
    {
      matterId,
      title: body.title,
      description: body.description,
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.requestedFrom !== undefined ? { requestedFrom: body.requestedFrom } : {}),
    },
    matter.organizationId,
  );
  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.get(matterId);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = (await req.json()) as {
    id?: string;
    status?: EvidenceStatus;
    fileUri?: string;
    sha256?: string;
    reviewedBy?: string;
  };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const store = getDefaultEvidenceStore();
  const updated = await store.updateStatus(body.id, body.status, {
    ...(body.fileUri !== undefined ? { fileUri: body.fileUri } : {}),
    ...(body.sha256 !== undefined ? { sha256: body.sha256 } : {}),
    ...(body.reviewedBy !== undefined ? { reviewedBy: body.reviewedBy } : {}),
  });
  if (!updated) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
