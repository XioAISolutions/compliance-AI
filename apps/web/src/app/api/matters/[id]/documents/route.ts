/**
 * POST /api/matters/[id]/documents — multipart upload with content ingestion.
 *
 * Replaces the filename-only PATCH `add-document` action with an honest
 * pipeline: read the file bytes → parse (PDF or text) → chunk → classify →
 * persist chunks into the matter's cognition corpus.
 *
 * The cognition items are scoped to the matter's organization +
 * jurisdiction + registration so retrieval during review surfaces this
 * tenant's own documents alongside the seeded authorities.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  parseDocumentFromBuffer,
  chunkDocument,
  classifyDocument,
  type ClassifiedDocType,
} from "@compliance-ai/ingestion";
import { getDefaultCognitionStore } from "@compliance-ai/cognition";
import { getDefaultMatterStore, type DocumentType } from "../../../../../lib/matter-store";
import { getDefaultAuditStore, sha256 } from "../../../../../lib/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard limit so a runaway upload can't pin the process. 25 MB covers
 *  most OMs + exhibits with headroom. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const PREVIEW_ORG_ID = "preview";

const DOC_TYPE_ALIASES: Record<ClassifiedDocType, DocumentType> = {
  "offering-memo": "offering-memo",
  "kyc-aml-file": "kyc-aml-file",
  "marketing-material": "marketing-material",
  "authority-rule": "authority-rule",
  "regulatory-guidance": "regulatory-guidance",
  "reference-material": "reference-material",
  other: "other",
};

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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob) || (file as File).size === 0) {
    return NextResponse.json({ error: "`file` is required" }, { status: 400 });
  }
  const filename = (file as File).name || "upload.bin";
  if ((file as File).size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB cap` },
      { status: 413 },
    );
  }

  const arrayBuffer = await (file as File).arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // --- Parse + chunk + classify ------------------------------------------
  const parsed = await parseDocumentFromBuffer(buffer, filename);
  const classification = classifyDocument({
    filename,
    firstPagePreview: parsed.firstPagePreview,
  });
  const documentType: DocumentType = DOC_TYPE_ALIASES[classification.type];

  // Add the matter-document record first so we have a stable docId to tag
  // each chunk with in the cognition store.
  const docRecord = matterStore.addDocument(matterId, filename, documentType);
  const chunks = chunkDocument(parsed, docRecord.id);
  matterStore.setDocumentChunkCount(docRecord.id, chunks.length);

  // Persist chunks to the securities cognition corpus. Title is
  // "<filename> · p.<page>" so the UI surfaces useful context when a
  // retrieval hits.
  const cognitionStore = getDefaultCognitionStore("securities");
  await cognitionStore.addBatch(
    chunks.map((c) => ({
      id: c.id,
      organizationId: PREVIEW_ORG_ID,
      title: `${filename} · p.${c.page ?? 1}`,
      content: c.content,
      source: filename,
      jurisdiction: matter.jurisdiction,
      registrationCategories: [matter.registrationCategory],
    })),
  );

  // Audit entry so the regulator-facing log records the upload event.
  getDefaultAuditStore().append(matterId, {
    matterId,
    organizationId: PREVIEW_ORG_ID,
    actor: "user",
    action: "upload",
    inputHash: sha256(filename),
    authoritiesUsed: [],
    outputHash: sha256(parsed.text.slice(0, 2048)),
    judgeVerdict: null,
    inputContent: `Uploaded ${filename} (${buffer.length} bytes, ${parsed.pageOffsets.length} pages)`,
    outputContent: `Parsed and chunked into ${chunks.length} chunks · auto-classified as ${documentType} (${classification.signal}, confidence ${classification.confidence.toFixed(2)})`,
  });

  return NextResponse.json({
    document: docRecord,
    ingestion: {
      chunkCount: chunks.length,
      pages: parsed.pageOffsets.length,
      bytes: buffer.length,
      classification,
    },
  });
}
