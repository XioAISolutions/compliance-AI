/**
 * Approvals API.
 *
 *   GET  /api/approvals         — list pending approvals (admin/owner view)
 *   POST /api/approvals         — create an approval request
 *   PATCH /api/approvals        — review (approve / reject / withdraw)
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultApprovalStore } from "../../../lib/approvals-store";
import { getDefaultAuditStore, sha256 } from "../../../lib/audit-store";
import { requireSession } from "../../../lib/auth";
import { consolidateMatterLessons, getLessonsBundle } from "../../../lib/lessons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const matterId = url.searchParams.get("matterId");

  const store = getDefaultApprovalStore();
  const items = matterId
    ? await store.listByMatter(matterId)
    : await store.listPending(session.organizationId);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    matterId?: string;
    outputHash?: string;
    summary?: string;
  };
  if (!body.matterId || !body.outputHash || !body.summary) {
    return NextResponse.json(
      { error: "matterId, outputHash, and summary required" },
      { status: 400 },
    );
  }

  const store = getDefaultApprovalStore();
  const item = await store.create(
    {
      matterId: body.matterId,
      outputHash: body.outputHash,
      summary: body.summary,
      requestedBy: session.user.id,
    },
    session.organizationId,
  );

  // Record the approval request in the matter's audit trail.
  const auditStore = getDefaultAuditStore();
  await auditStore.append(body.matterId, {
    matterId: body.matterId,
    organizationId: session.organizationId,
    actor: session.user.email,
    action: "verdict",
    inputHash: body.outputHash,
    authoritiesUsed: [],
    outputHash: sha256(item.id),
    judgeVerdict: "APPROVAL_REQUESTED",
    inputContent: `Approval requested for: ${body.summary}`,
    outputContent: `Approval id: ${item.id}`,
  });

  // Approval-request is the cleanest "session close" signal we have —
  // the lawyer is saying this matter's review is done. Fire-and-forget
  // the lesson consolidation pass; the response shouldn't wait. The
  // scheduler also gets a session-close wake so the garden picks up
  // any deeper consolidation later.
  void consolidateMatterLessons(body.matterId, item.id).catch(() => {
    // Advisory; swallow.
  });
  try {
    getLessonsBundle().scheduler.notifySessionClose(session.organizationId);
  } catch {
    // Scheduler optional in test envs.
  }

  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only owners / admins can approve or reject.
  const canReview = session.user.role === "owner" || session.user.role === "admin";

  const body = (await req.json()) as {
    id?: string;
    status?: "approved" | "rejected" | "withdrawn";
    rationale?: string;
  };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "id and status required" }, { status: 400 });
  }

  const store = getDefaultApprovalStore();

  let item;
  if (body.status === "withdrawn") {
    item = await store.withdraw(body.id, session.user.id);
  } else {
    if (!canReview) {
      return NextResponse.json(
        { error: "Only owners and admins can approve or reject" },
        { status: 403 },
      );
    }
    item = await store.review({
      id: body.id,
      status: body.status,
      reviewedBy: session.user.id,
      ...(body.rationale !== undefined ? { rationale: body.rationale } : {}),
    });
  }

  if (!item) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  // Audit the review outcome.
  const auditStore = getDefaultAuditStore();
  await auditStore.append(item.matterId, {
    matterId: item.matterId,
    organizationId: session.organizationId,
    actor: session.user.email,
    action: "verdict",
    inputHash: item.outputHash,
    authoritiesUsed: [],
    outputHash: sha256(item.id),
    judgeVerdict: `APPROVAL_${body.status.toUpperCase()}`,
    inputContent: body.rationale ?? null,
    outputContent: `Approval ${body.status}: ${item.summary}`,
  });

  return NextResponse.json(item);
}
