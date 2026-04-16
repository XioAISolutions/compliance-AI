/**
 * Matter-scoped refinement chat — POST /api/matters/[id]/chat
 *
 * Mirrors the legacy /api/chat endpoint but auto-applies the matter's
 * jurisdiction + registration category filters on retrieval, and runs in
 * single-shot (no judge loop) mode. This is what the refinement drawer
 * posts to from /matters/[id].
 *
 * The legacy /api/chat stays for the infosec /controls surface — different
 * surface, different seeded authorities, different persona routing.
 */

import { NextRequest } from "next/server";
import {
  runAgent,
  type AgentContext,
  type AgentMessage,
  type RetrievedSnippet,
} from "@compliance-ai/agents";
import { getDefaultCognitionStore, type RetrievalResult } from "@compliance-ai/cognition";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_ORG_ID = "preview";
const DEFAULT_TOP_K = 4;
const DEFAULT_SCORE_THRESHOLD = 0.02;

interface ChatBody {
  message: string;
  history?: AgentMessage[];
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = getDefaultMatterStore().get(id);
  if (!matter) {
    return new Response("Matter not found", { status: 404 });
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body.message || typeof body.message !== "string") {
    return new Response("`message` is required", { status: 400 });
  }

  const history = body.history ?? [];
  const userMessage = body.message;

  // Retrieve using the matter's scope — this is what distinguishes the
  // drawer from the legacy /api/chat endpoint.
  let retrievedSnippets: RetrievedSnippet[] = [];
  try {
    const store = getDefaultCognitionStore("securities");
    const results = await store.retrieve({
      query: userMessage,
      topK: DEFAULT_TOP_K,
      organizationId: PREVIEW_ORG_ID,
      jurisdiction: matter.jurisdiction,
      registrationCategory: matter.registrationCategory,
      scoreThreshold: DEFAULT_SCORE_THRESHOLD,
    });
    retrievedSnippets = results.map(toRetrievedSnippet);
  } catch {
    retrievedSnippets = [];
  }

  const context: AgentContext = {
    control: null,
    frameworkScope: [],
    organizationId: PREVIEW_ORG_ID,
    retrievedSnippets,
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of runAgent(context, history, userMessage)) {
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
      "X-Accel-Buffering": "no",
    },
  });
}
