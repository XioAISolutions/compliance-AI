import { NextRequest } from "next/server";
import {
  runAgent,
  type AgentContext,
  type AgentMessage,
  type PersonaId,
  type RetrievedSnippet,
  type ReviewSubject,
} from "@compliance-ai/agents";
import { getDefaultCognitionStore, type RetrievalResult } from "@compliance-ai/cognition";
import { getDefaultAuditStore, sha256 } from "../../../../../lib/audit-store";
import { ensureTenant } from "../../../../../lib/bootstrap";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";
import { requireSession } from "../../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TOP_K = 5;

interface MatterChatRequest {
  message: string;
  history?: AgentMessage[];
  agentId?: PersonaId;
  topK?: number;
}

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
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

async function buildReviewSubject(matterId: string): Promise<ReviewSubject | undefined> {
  const store = getDefaultMatterStore();
  const docs = await store.getDocuments(matterId);
  const doc = docs[docs.length - 1];
  if (!doc) return undefined;
  const chunks = await store.getChunksByDoc(doc.id);
  if (chunks.length === 0) return undefined;
  return {
    documentId: doc.id,
    documentType: doc.documentType,
    title: doc.filename,
    chunks: chunks.slice(0, 12).map((chunk) => ({
      chunkId: chunk.id,
      ordinal: chunk.ordinal,
      ...(chunk.page !== undefined ? { page: chunk.page } : {}),
      content: chunk.content,
    })),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: MatterChatRequest;
  try {
    body = (await req.json()) as MatterChatRequest;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!body.message || typeof body.message !== "string") {
    return new Response("`message` is required", { status: 400 });
  }

  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.get(matterId);
  if (!matter) {
    return new Response("Matter not found", { status: 404 });
  }

  await ensureTenant(matter.organizationId, "securities");
  const reviewSubject = await buildReviewSubject(matterId);
  const cognitionStore = getDefaultCognitionStore("securities");
  let retrievedSnippets: RetrievedSnippet[] = [];
  try {
    const query = reviewSubject
      ? `${body.message}\n\n${reviewSubject.chunks.map((chunk) => chunk.content).join("\n").slice(0, 1800)}`
      : body.message;
    const results = await cognitionStore.retrieve({
      query,
      topK: body.topK ?? DEFAULT_TOP_K,
      organizationId: session.organizationId,
      jurisdiction: matter.jurisdiction,
      registrationCategory: matter.registrationCategory,
      searchMode: "hybrid",
      scoreThreshold: 0.02,
    });
    retrievedSnippets = results.map(toRetrievedSnippet);
  } catch {
    retrievedSnippets = [];
  }

  const context: AgentContext = {
    control: null,
    frameworkScope: [],
    organizationId: session.organizationId,
    retrievedSnippets,
    ...(reviewSubject ? { reviewSubject } : {}),
  };

  const auditStore = getDefaultAuditStore();
  await auditStore.append(matterId, {
    matterId,
    organizationId: session.organizationId,
    actor: body.agentId ?? "reviewer",
    action: "query",
    inputHash: sha256(body.message),
    authoritiesUsed: retrievedSnippets.map((snippet) => snippet.id),
    outputHash: null,
    judgeVerdict: null,
    inputContent: body.message,
    outputContent: null,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullOutput = "";
      try {
        const generator = runAgent(context, body.history ?? [], body.message, {
          forcePersona: body.agentId,
        });
        for await (const event of generator) {
          if (event.type === "text-delta") fullOutput += event.delta;
          controller.enqueue(encoder.encode(sseFrame(event)));
        }
        if (fullOutput) {
          await auditStore.append(matterId, {
            matterId,
            organizationId: session.organizationId,
            actor: body.agentId ?? "reviewer",
            action: "generation",
            inputHash: sha256(body.message),
            authoritiesUsed: retrievedSnippets.map((snippet) => snippet.id),
            outputHash: sha256(fullOutput),
            judgeVerdict: null,
            inputContent: "Matter-scoped refinement",
            outputContent: fullOutput.slice(0, 2000),
          });
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
