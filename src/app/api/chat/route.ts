import { NextRequest } from "next/server";
import { queryStream } from "@/lib/citation-engine";

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question?.trim())
      return new Response(JSON.stringify({ error: "Question is required" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of queryStream(question)) {
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
