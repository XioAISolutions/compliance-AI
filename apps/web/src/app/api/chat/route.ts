/**
 * Chat API — POST /api/chat
 *
 * Streams Server-Sent Events (SSE) from the agent runner. Each line is
 * `data: <json>\n\n` carrying one `AgentEvent`.
 *
 * Two execution modes:
 *   - `mode: "single"` (default) — one `runAgent` pass; router picks the persona.
 *   - `mode: "loop"`             — drafter ↔ judge tight loop via `runAgentLoop`.
 *                                  Adds round-started / verdict-final / loop-done events.
 *
 * Cognition retrieval: by default we hit the cognition store with the user
 * message (filtered to the active control's framework + slug when present) and
 * pass the top-k snippets through to the agent context. The default in-memory
 * store starts empty, so this is a no-op until snippets get seeded — which
 * means the route works end-to-end on day 1 without any setup.
 *
 * Preview-mode caveat: this route currently materializes a placeholder
 * `Control` from the static catalog (no DB-backed tenant controls yet —
 * Day 3 wires Drizzle + RLS). All requests use `organizationId: "preview"`.
 */

import { NextRequest } from "next/server";
import {
  runAgent,
  runAgentLoop,
  type AgentContext,
  type AgentMessage,
  type RetrievedSnippet,
} from "@compliance-ai/agents";
import {
  CATALOGS,
  type CatalogEntry,
  type Control,
  type FrameworkId,
} from "@compliance-ai/frameworks";
import { getDefaultCognitionStore, type RetrievalResult } from "@compliance-ai/cognition";
import { getSession } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TOP_K = 4;
const DEFAULT_SCORE_THRESHOLD = 0.05;

interface ChatRequestBody {
  /** e.g. "soc2.cc6.1" — looks up the catalog entry. Optional for cross-cutting questions. */
  controlSlug?: string;
  /** When `controlSlug` is omitted, restrict reasoning to these frameworks. */
  frameworkScope?: FrameworkId[];
  /** Prior conversation turns. Ignored in `loop` mode (loop owns its own history). */
  history?: AgentMessage[];
  message: string;
  /** "single" = one runAgent pass. "loop" = drafter ↔ judge tight loop. Default "single". */
  mode?: "single" | "loop";
  /** Loop-mode only. Default in `runAgentLoop` is 4. */
  maxRounds?: number;
  /** Disable cognition retrieval. Default: enabled (graceful no-op when store is empty). */
  retrieve?: boolean;
  /** Cognition top-k. Default 4. */
  topK?: number;
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
function materializePreviewControl(entry: CatalogEntry, organizationId: string): Control {
  const now = new Date();
  return {
    ...entry,
    id: `preview:${entry.slug}`,
    organizationId,
    ownerId: null,
    status: "not-started",
    createdAt: now,
    updatedAt: now,
  } as Control;
}

/** Adapter: cognition's `RetrievalResult` → agents' `RetrievedSnippet`. */
function toRetrievedSnippet(result: RetrievalResult): RetrievedSnippet {
  return {
    id: result.item.id ?? "",
    title: result.item.title,
    content: result.item.content,
    source: result.item.source,
    score: result.score,
  };
}

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const organizationId = session?.organizationId ?? "preview";

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
    control = materializePreviewControl(entry, organizationId);
  }

  const frameworkScope =
    body.frameworkScope && body.frameworkScope.length > 0 ? body.frameworkScope : ALL_FRAMEWORKS;
  const history = body.history ?? [];
  const userMessage = body.message;
  const mode = body.mode ?? "single";

  // --- Cognition retrieval -------------------------------------------------
  // Filtered by the active control when present; otherwise tenant-wide.
  // Empty result is the common case in dev and is forwarded as `[]`.
  let retrievedSnippets: RetrievedSnippet[] = [];
  if (body.retrieve !== false) {
    try {
      const store = getDefaultCognitionStore();
      const results = await store.retrieve({
        query: userMessage,
        topK: body.topK ?? DEFAULT_TOP_K,
        organizationId: organizationId,
        framework: control?.framework,
        controlSlug: control?.slug,
        scoreThreshold: DEFAULT_SCORE_THRESHOLD,
      });
      retrievedSnippets = results.map(toRetrievedSnippet);
    } catch {
      // Retrieval failure must not block generation. Fall through with no snippets.
      retrievedSnippets = [];
    }
  }

  const context: AgentContext = {
    control,
    frameworkScope,
    organizationId: organizationId,
    retrievedSnippets,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        const generator =
          mode === "loop"
            ? runAgentLoop(context, userMessage, { maxRounds: body.maxRounds })
            : runAgent(context, history, userMessage);

        for await (const event of generator) {
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
