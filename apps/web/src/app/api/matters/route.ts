/**
 * Matters API — GET (list) + POST (create).
 *
 * Preview mode: uses in-memory MatterStore. Day 3 swaps for Drizzle + Postgres.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultMatterStore, type CreateMatterInput } from "../../../lib/matter-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = getDefaultMatterStore();
  const matters = await store.list();
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

  const store = getDefaultMatterStore();
  const matter = await store.create(body);
  return NextResponse.json(matter, { status: 201 });
}
