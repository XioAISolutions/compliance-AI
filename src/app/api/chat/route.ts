import { NextRequest } from "next/server";
import { queryStream } from "@/lib/citation-engine";
import type { Strategy } from "@/lib/retrieval-strategies";
import { effectiveMatterIds } from "@/lib/matters";
import { DOC_TYPES, type DocType, type RetrievalFilter } from "@/lib/retrieval-filter";

const VALID_STRATEGIES: Strategy[] = ["hybrid", "hyde", "multi"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const question: string | undefined = body.question;
    const rawStrategy: string | undefined = body.strategy;
    const rawJudge: unknown = body.judge;
    if (!question?.trim())
      return new Response(JSON.stringify({ error: "Question is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    const strategy = VALID_STRATEGIES.includes(rawStrategy as Strategy) ? (rawStrategy as Strategy) : "hybrid";
    // Accept true | "weak" | false; reject anything else so we never pay the
    // judge cost by accident.
    const judge: boolean | "weak" = rawJudge === true ? true : rawJudge === "weak" ? "weak" : false;

    // Scope retrieval to a matter (plus any statute libraries it subscribes
    // to) when a matterId is provided. When omitted, existing callers keep
    // their whole-corpus behavior.
    let filter: RetrievalFilter | undefined;
    if (typeof body.matterId === "string" && body.matterId.length > 0) {
      const matterIds = await effectiveMatterIds(body.matterId);
      filter = { matterIds };
    }
    if (Array.isArray(body.docTypes) && body.docTypes.length > 0) {
      const dts = body.docTypes.filter((d: unknown) => typeof d === "string" && DOC_TYPES.includes(d as DocType)) as DocType[];
      if (dts.length > 0) filter = { ...(filter ?? {}), docTypes: dts };
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of queryStream(question, { strategy, judge, filter })) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", data: err.message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
