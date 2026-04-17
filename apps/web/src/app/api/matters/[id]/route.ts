/**
 * Matter detail API — GET (with authorities + audit) + PATCH (add document, update status).
 *
 * On GET, auto-loads authorities from the cognition store based on the
 * matter's jurisdiction + registration category. This is the "context
 * auto-assembly" from the redesign spec.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultMatterStore, type DocumentType } from "../../../../lib/matter-store";
import { getDefaultAuditStore } from "../../../../lib/audit-store";
import { getDefaultCognitionStore } from "@compliance-ai/cognition";
import { ensureTenant } from "../../../../lib/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Determine which authorities are excluded based on matter scope and why.
 */
function getExclusions(
  jurisdiction: string,
  registrationCategory: string,
): { rule: string; reason: string }[] {
  const exclusions: { rule: string; reason: string }[] = [];

  if (registrationCategory !== "iiroc") {
    exclusions.push({
      rule: "IIROC Dealer Member Rules",
      reason: `Registration category is ${registrationCategory.toUpperCase()}, not IIROC`,
    });
  }
  if (registrationCategory !== "pm" && registrationCategory !== "iiroc") {
    exclusions.push({
      rule: "NI 81-102 Parts 1-14 (fund-specific)",
      reason: `Only Part 15 (sales communications) applies to ${registrationCategory.toUpperCase()}`,
    });
  }
  if (jurisdiction !== "quebec") {
    exclusions.push({
      rule: "AMF Regulation 45-106 (Quebec variant)",
      reason: `Jurisdiction is ${jurisdiction}, not Quebec`,
    });
  }

  return exclusions;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.get(id);

  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  // Seed authorities and retrieve those matching the matter's scope
  await ensureTenant(matter.organizationId);
  const cognitionStore = getDefaultCognitionStore("securities");
  const allItems = await cognitionStore.getAll();

  // Filter authorities by jurisdiction + registration category
  const authorities = allItems
    .filter((item) => {
      if (item.jurisdiction && item.jurisdiction !== matter.jurisdiction) return false;
      if (
        item.registrationCategories?.length &&
        !item.registrationCategories.includes(matter.registrationCategory)
      )
        return false;
      return true;
    })
    .map((item) => ({
      id: item.id ?? "",
      title: item.title,
      source: item.source ?? "",
    }));

  const excluded = getExclusions(matter.jurisdiction, matter.registrationCategory);
  const documents = await matterStore.getDocuments(id);

  // Audit trail
  const auditStore = getDefaultAuditStore();
  const auditEntries = await auditStore.getByMatter(id);
  const auditVerified = await auditStore.verify(id);

  return NextResponse.json({
    matter,
    documents,
    authorities,
    excluded,
    auditEntries,
    auditVerified,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.get(id);

  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  if (body.action === "add-document") {
    const filename = body.filename as string;
    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }
    // Auto-classify based on filename
    const docType = classifyDocument(filename);
    const doc = await matterStore.addDocument(id, filename, docType);
    return NextResponse.json(doc);
  }

  if (body.status && typeof body.status === "string") {
    // Validate against the full MatterStatus union; reject garbage so a
    // client can't put a matter into an unknown state.
    const validStatuses = [
      "open",
      "in-review",
      "complete",
      "needs-revision",
      "blocked",
      "archived",
    ] as const;
    type ValidStatus = (typeof validStatuses)[number];
    if (!(validStatuses as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: `Unknown status: ${body.status}` }, { status: 400 });
    }
    const updated = await matterStore.updateStatus(id, body.status as ValidStatus);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/** Zero-shot document classification by filename heuristics. */
function classifyDocument(filename: string): DocumentType {
  const lower = filename.toLowerCase();
  if (/offering.memo|\.om\b/i.test(lower)) return "offering-memo";
  if (/authority|rule|regulation|ni[\s-]|osc[\s-]/i.test(lower)) return "authority-rule";
  if (/kyc|aml|know.your/i.test(lower)) return "kyc-aml-file";
  if (/marketing|brochure|pitch|deck/i.test(lower)) return "marketing-material";
  if (/guidance|staff.notice|bulletin/i.test(lower)) return "regulatory-guidance";
  return "other";
}
