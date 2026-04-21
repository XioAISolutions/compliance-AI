/**
 * POST /api/precedent
 *
 * Ingests a prior matter's approved output (or any firm-owned
 * authority) as a citable precedent. The item lands in the same
 * cognition store the seeded statute packs use, so every reviewer's
 * retrieval merges firm precedent alongside statutes with no
 * additional code path needed — the sourceType badge + jurisdiction
 * filter are enough to keep the UI and the audit honest.
 *
 * Request body:
 *   { title, content, jurisdiction?, registrationCategories?,
 *     authorityDate?, privilege?, source? }
 *
 * Defaults:
 *   sourceType = "firm-precedent"
 *   privilege  = "work-product"   (past memos usually are; uploader
 *                                   overrides when they aren't)
 *   jurisdiction omitted → visible across every provincial query
 *                          (multi-provincial retrieval semantics)
 *
 * GET /api/precedent
 *   Returns a summary list of the tenant's firm-precedent items so
 *   the operator page can show "you have 14 prior memos in your
 *   corpus" without streaming content.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getDefaultCognitionStore,
  type CognitionItem,
} from "@compliance-ai/cognition";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PRIVILEGE = new Set([
  "none",
  "solicitor-client",
  "litigation",
  "work-product",
  "common-interest",
]);

interface PrecedentBody {
  title: string;
  content: string;
  jurisdiction?: string;
  registrationCategories?: string[];
  authorityDate?: string;
  /** Defaults to "work-product" — past memos typically are. */
  privilege?: string;
  /** Free-form provenance label ("Smith v. Acme memo, 2024-Q2"). */
  source?: string;
  /** Target tenant. Defaults to "preview". */
  organizationId?: string;
}

export async function POST(req: NextRequest) {
  let body: PrecedentBody;
  try {
    body = (await req.json()) as PrecedentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "`title` is required" }, { status: 400 });
  }
  if (!body.content || typeof body.content !== "string" || body.content.length < 50) {
    return NextResponse.json(
      { error: "`content` is required (at least 50 chars)" },
      { status: 400 },
    );
  }
  const privilege = body.privilege ?? "work-product";
  if (!VALID_PRIVILEGE.has(privilege)) {
    return NextResponse.json(
      { error: `invalid privilege value '${privilege}'` },
      { status: 400 },
    );
  }

  const organizationId = body.organizationId ?? "preview";
  const store = getDefaultCognitionStore();

  // Ingest as a single cognition item; chunking per-paragraph can be
  // added as a follow-up once the corpus starts handling >50KB
  // documents regularly. For now, the simpler shape is fine because
  // the retrieval layer already tokenizes at query time.
  const item: CognitionItem = {
    organizationId,
    title: body.title,
    content: body.content,
    source: body.source ?? "Firm precedent",
    sourceType: "firm-precedent",
    ...(body.jurisdiction ? { jurisdiction: body.jurisdiction } : {}),
    ...(body.registrationCategories && body.registrationCategories.length > 0
      ? { registrationCategories: body.registrationCategories }
      : {}),
    ...(body.authorityDate ? { authorityDate: body.authorityDate } : {}),
    privilege: privilege as CognitionItem["privilege"],
  };
  const id = await store.add(item);

  return NextResponse.json(
    {
      id,
      title: item.title,
      sourceType: item.sourceType,
      privilege: item.privilege,
      jurisdiction: item.jurisdiction ?? null,
      authorityDate: item.authorityDate ?? null,
      source: item.source,
    },
    { status: 201 },
  );
}

export async function GET(req: NextRequest) {
  const organizationId = new URL(req.url).searchParams.get("organizationId") ?? "preview";
  const store = getDefaultCognitionStore();
  const all = await store.getAll();
  const items = all.filter(
    (it) => it.organizationId === organizationId && it.sourceType === "firm-precedent",
  );
  return NextResponse.json({
    count: items.length,
    items: items.map((it) => ({
      id: it.id,
      title: it.title,
      jurisdiction: it.jurisdiction ?? null,
      authorityDate: it.authorityDate ?? null,
      privilege: it.privilege ?? "none",
      contentChars: it.content.length,
    })),
  });
}
