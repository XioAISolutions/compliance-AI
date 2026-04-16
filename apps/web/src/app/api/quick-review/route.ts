/**
 * Quick review — one-drop flow.
 *
 *   POST /api/quick-review (multipart/form-data, `file` field)
 *
 * Pipeline:
 *   1. Parse the uploaded file (pdf-parse / mammoth / text)
 *   2. Classify by content (document type, task type, jurisdiction, registration)
 *   3. Create a matter with the inferred fields and a title derived from the content
 *   4. Chunk + store the document against that matter
 *   5. Return { matterId, matter, documentId, classification }
 *
 * The client then navigates to /matters/[matterId] and kicks off the review.
 * We do NOT start the review here — streaming a review response inside a
 * multipart POST is fragile, and the user wants to see the matter detail
 * page (with context + evidence panels) while the review runs.
 *
 * Total cost from drop to matter page: one HTTP round-trip + a client-side
 * redirect. Total user clicks: one drag-and-drop.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  chunkDocument,
  classifyDocument,
  parseDocument,
  type InferredJurisdiction,
  type InferredRegistrationCategory,
} from "@compliance-ai/ingest";
import {
  getDefaultMatterStore,
  type DocumentType,
  type Jurisdiction,
  type RegistrationCategory,
  type TaskType,
} from "../../../lib/matter-store";
import { getDefaultAuditStore, sha256 } from "../../../lib/audit-store";
import { ensureTenant } from "../../../lib/bootstrap";
import { requireSession } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = session.organizationId;
  await ensureTenant(organizationId);

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

  const buffer = Buffer.from(await file.arrayBuffer());
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

  const classification = classifyDocument(parsed);

  // Compose a matter title from the classification + filename.
  const title =
    classification.suggestedTitle?.slice(0, 80) ??
    stripExt(file.name) ??
    `Review — ${new Date().toLocaleDateString("en-CA")}`;

  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.create(
    {
      title,
      jurisdiction: mapJurisdiction(classification.jurisdiction),
      registrationCategory: mapRegistrationCategory(classification.registrationCategory),
      taskType: mapTaskType(classification.taskType),
    },
    organizationId,
  );

  // Upload the document to the new matter.
  const docType = mapDocumentType(classification.documentType);
  const pageCount = parsed.pages?.length;
  const doc = await matterStore.addDocument(matter.id, file.name, docType, {
    sha256: fileHash,
    ...(pageCount !== undefined ? { pageCount } : {}),
  });

  const chunks = chunkDocument(parsed, doc.id);
  const stored = await matterStore.addChunks(matter.id, doc.id, chunks);

  // Write a combined audit entry recording the quick-review intake.
  const auditStore = getDefaultAuditStore();
  await auditStore.append(matter.id, {
    matterId: matter.id,
    organizationId,
    actor: session.user.email,
    action: "retrieval",
    inputHash: fileHash,
    authoritiesUsed: [],
    outputHash: sha256(stored.map((c) => c.id).join(",")),
    judgeVerdict: null,
    inputContent: `Quick review intake: ${file.name} (${file.size} bytes, ${pageCount ?? "?"} pages) — classified as ${classification.documentType} with confidence ${classification.confidence.toFixed(2)}`,
    outputContent: `Matter "${title}" created (${matter.taskType}, ${matter.jurisdiction}/${matter.registrationCategory}). ${stored.length} chunks indexed.`,
  });

  return NextResponse.json(
    {
      matterId: matter.id,
      matter,
      documentId: doc.id,
      document: doc,
      classification,
      redirectTo: `/matters/${matter.id}?autoStart=1`,
    },
    { status: 201 },
  );
}

function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function mapDocumentType(d: string): DocumentType {
  // "regulator-inquiry" isn't in the UI's DocumentType enum; store it as
  // "reference-material" so the review route can still pick it up as the
  // subject for the response-memo drafter.
  switch (d) {
    case "authority-rule":
    case "regulatory-guidance":
    case "offering-memo":
    case "kyc-aml-file":
    case "marketing-material":
    case "reference-material":
      return d;
    case "regulator-inquiry":
      return "reference-material";
    default:
      return "other";
  }
}

function mapTaskType(t: string | null): TaskType {
  if (t === "om-review" || t === "kyc-gap-check" || t === "marketing-signoff" || t === "response-memo") {
    return t;
  }
  return "om-review";
}

function mapJurisdiction(j: InferredJurisdiction | null): Jurisdiction {
  return j ?? "ontario";
}

function mapRegistrationCategory(
  r: InferredRegistrationCategory | null,
): RegistrationCategory {
  return r ?? "emd";
}
