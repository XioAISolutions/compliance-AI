/**
 * Matters API — GET (list with filters) + POST (create with consumer-law fields).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getDefaultMatterStore,
  type ClaimType,
  type CreateMatterInput,
  type MatterListFilters,
  type MatterStatus,
  type ProceduralPosture,
} from "../../../lib/matter-store";
import { getDefaultApprovalStore } from "../../../lib/approvals-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-matter approval summary surfaced in the matters-list triage chips.
 * Cheap to compute (one approval-store read per matter) but opt-in via
 * ?withApprovals=1 so the legacy clients (handoff, transcript exporters)
 * that only need the matter shape don't pay the cost.
 */
interface ApprovalSummary {
  requested: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  /** Most-recent approval status, regardless of whether it's terminal. */
  latest: "requested" | "approved" | "rejected" | "withdrawn" | null;
}

export async function GET(req: NextRequest) {
  const store = getDefaultMatterStore();
  // `new URL(req.url)` instead of `req.nextUrl` keeps this route
  // testable with a plain `Request` (vitest) and identical at runtime
  // — `req.nextUrl` is sugar over the same parsing.
  const url = new URL(req.url);

  const filters: MatterListFilters = {};
  const status = url.searchParams.get("status");
  if (status) filters.status = status as MatterStatus;
  const claimType = url.searchParams.get("claimType");
  if (claimType) filters.claimType = claimType as ClaimType;
  const posture = url.searchParams.get("posture");
  if (posture) filters.proceduralPosture = posture as ProceduralPosture;
  if (url.searchParams.get("classAction") === "true") filters.classActionOnly = true;
  if (url.searchParams.get("overdue") === "true") filters.hasOverdueDeadline = true;
  const search = url.searchParams.get("q");
  if (search) filters.search = search;

  const hasFilters = Object.keys(filters).length > 0;
  const matters = await store.list(undefined, hasFilters ? filters : undefined);

  if (url.searchParams.get("withApprovals") !== "1") {
    return NextResponse.json(matters);
  }

  // Enrich with per-matter approval summary. Sequential because the
  // in-memory store is sync and the Postgres store benefits from
  // connection-pool reuse over parallel fan-out.
  const approvalStore = getDefaultApprovalStore();
  const enriched = await Promise.all(
    matters.map(async (m) => {
      const approvals = await approvalStore.listByMatter(m.id);
      const summary: ApprovalSummary = {
        requested: 0,
        approved: 0,
        rejected: 0,
        withdrawn: 0,
        latest: null,
      };
      for (const a of approvals) {
        summary[a.status] += 1;
      }
      // listByMatter returns newest-first.
      summary.latest = (approvals[0]?.status as ApprovalSummary["latest"]) ?? null;
      return { ...m, approvalSummary: summary };
    }),
  );
  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  let body: CreateMatterInput;
  try {
    body = (await req.json()) as CreateMatterInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Parse date strings into Date objects for consumer-law fields
  if (body.limitationDate && typeof body.limitationDate === "string") {
    body.limitationDate = new Date(body.limitationDate);
  }
  if (body.certificationDate && typeof body.certificationDate === "string") {
    body.certificationDate = new Date(body.certificationDate);
  }
  if (body.nextDeadline && typeof body.nextDeadline === "string") {
    body.nextDeadline = new Date(body.nextDeadline);
  }

  const store = getDefaultMatterStore();
  const matter = await store.create(body);
  return NextResponse.json(matter, { status: 201 });
}
