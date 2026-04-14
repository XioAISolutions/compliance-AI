import { NextRequest } from "next/server";
import { queryStream } from "@/lib/citation-engine";
import type { Strategy } from "@/lib/retrieval-strategies";

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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of queryStream(question, { strategy, judge })) {
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
