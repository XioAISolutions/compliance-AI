/**
 * Chat API — POST /api/chat
 *
 * Streams Server-Sent Events (SSE) from the agent runner. Each line is
 * `data: <json>\n\n` carrying one `AgentEvent` (persona-selected | text-delta
 * | done | error).
 *
 * Preview-mode caveat: this route currently materializes a placeholder
 * `Control` from the static catalog (no DB-backed tenant controls yet —
 * Day 3 wires Drizzle + RLS). All requests use `organizationId: "preview"`.
 */

import { NextRequest } from "next/server";
import { runAgent, type AgentMessage } from "@compliance-ai/agents";
import {
  CATALOGS,
  type CatalogEntry,
  type Control,
  type FrameworkId,
} from "@compliance-ai/frameworks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  /** e.g. "soc2.cc6.1" — looks up the catalog entry. Optional for cross-cutting questions. */
  controlSlug?: string;
  /** When `controlSlug` is omitted, restrict reasoning to these frameworks. */
  frameworkScope?: FrameworkId[];
  history?: AgentMessage[];
  message: string;
}

const ALL_FRAMEWORKS: FrameworkId[] = ["soc2", "gdpr", "eu-ai-act", "iso-27001"];

function findCatalogEntry(slug: string): CatalogEntry | null {
  for (const entries of Object.values(CATALOGS)) {
    const hit = entries.find((e) => e.slug === slug);
    if (hit) return hit;
  }
  return null;
}

/**
 * Materialize a catalog entry into a full Control with placeholder tenant
 * fields. When the DB layer is wired (Day 3), this function is replaced with a
 * row lookup keyed by (organizationId, slug).
 */
function materializePreviewControl(entry: CatalogEntry): Control {
  const now = new Date();
  return {
    ...entry,
    id: `preview:${entry.slug}`,
    organizationId: "preview",
    ownerId: null,
    status: "not-started",
    createdAt: now,
    updatedAt: now,
  } as Control;
}

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!body.message || typeof body.message !== "string") {
    return new Response("`message` is required", { status: 400 });
  }

  let control: Control | null = null;
  if (body.controlSlug) {
    const entry = findCatalogEntry(body.controlSlug);
    if (!entry) {
      return new Response(`Unknown control slug: ${body.controlSlug}`, {
        status: 404,
      });
    }
    control = materializePreviewControl(entry);
  }

  const frameworkScope =
    body.frameworkScope && body.frameworkScope.length > 0 ? body.frameworkScope : ALL_FRAMEWORKS;

  const history = body.history ?? [];
  const userMessage = body.message;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of runAgent(
          {
            control,
            frameworkScope,
            organizationId: "preview",
          },
          history,
          userMessage,
        )) {
          controller.enqueue(encoder.encode(sseFrame(event)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(sseFrame({ type: "error", message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Disable Next.js's default response buffering for streaming endpoints.
      "X-Accel-Buffering": "no",
    },
  });
}
