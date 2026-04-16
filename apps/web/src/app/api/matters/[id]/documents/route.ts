/**
 * Document upload API — POST /api/matters/[id]/documents
 *
 * Accepts multipart/form-data with a `file` field. Reads the bytes, hashes
 * them (SHA-256), parses via @compliance-ai/ingest, chunks the result, and
 * stores everything in the matter store + per-matter chunk index.
 *
 * Returns the created MatterDocument with a real chunkCount.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { parseDocument, chunkDocument } from "@compliance-ai/ingest";
import {
  getDefaultMatterStore,
  type DocumentType,
} from "../../../../../lib/matter-store";
import { getDefaultAuditStore, sha256 } from "../../../../../lib/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap uploads at 25 MB. The reviewer can handle documents up to this size;
// anything bigger should be split client-side.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function classifyDocument(filename: string): DocumentType {
  const lower = filename.toLowerCase();
  if (/offering.memo|\.om\b/i.test(lower)) return "offering-memo";
  if (/authority|rule|regulation|ni[\s-]|osc[\s-]/i.test(lower)) return "authority-rule";
  if (/kyc|aml|know.your/i.test(lower)) return "kyc-aml-file";
  if (/marketing|brochure|pitch|deck/i.test(lower)) return "marketing-material";
  if (/guidance|staff.notice|bulletin/i.test(lower)) return "regulatory-guidance";
  return "other";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const matterStore = getDefaultMatterStore();
  const matter = matterStore.get(matterId);

  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_UPLOAD_BYTES} bytes)` },
      { status: 413 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  let parsed;
  try {
    parsed = await parseDocument(buffer, {
      filename: file.name,
      mimeType: file.type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Parse failed: ${msg}` }, { status: 400 });
  }

  const documentType = classifyDocument(file.name);
  const pageCount = parsed.pages?.length;

  const doc = matterStore.addDocument(matterId, file.name, documentType, {
    sha256: fileHash,
    ...(pageCount !== undefined ? { pageCount } : {}),
  });

  const chunks = chunkDocument(parsed, doc.id);
  const stored = matterStore.addChunks(matterId, doc.id, chunks);

  // Write audit trail entry for the upload + chunking
  const auditStore = getDefaultAuditStore();
  auditStore.append(matterId, {
    matterId,
    organizationId: matter.organizationId,
    actor: "system",
    action: "retrieval",
    inputHash: fileHash,
    authoritiesUsed: [],
    outputHash: sha256(stored.map((c) => c.id).join(",")),
    judgeVerdict: null,
    inputContent: `Uploaded ${file.name} (${file.size} bytes, ${pageCount ?? "?"} pages)`,
    outputContent: `Produced ${stored.length} chunks for review context`,
  });

  return NextResponse.json(
    {
      ...doc,
      chunkCount: stored.length,
    },
    { status: 201 },
  );
}
