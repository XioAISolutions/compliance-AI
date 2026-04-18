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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const store = getDefaultMatterStore();
  const url = req.nextUrl;

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
  return NextResponse.json(matters);
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
