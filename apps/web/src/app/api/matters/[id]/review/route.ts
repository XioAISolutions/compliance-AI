/**
 * OM Review API — POST /api/matters/[id]/review
 *
 * Runs the OM reviewer persona through the judge loop and streams SSE
 * events. Seeds the cognition store with Ontario/EMD authorities on
 * first call, then retrieves relevant snippets filtered by the matter's
 * jurisdiction and registration category.
 *
 * Also writes audit trail entries for each phase (query, retrieval,
 * generation, verdict).
 */

import { NextRequest } from "next/server";
import {
  runAgentLoop,
  type AgentContext,
  type PersonaId,
  type RetrievedSnippet,
} from "@compliance-ai/agents";
import { getDefaultCognitionStore, ONTARIO_EMD_AUTHORITIES, type RetrievalResult } from "@compliance-ai/cognition";
import {
  getDefaultTranscriptStore,
  type TurnKind,
} from "@compliance-ai/chat-structure";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";
import { getDefaultAuditStore, sha256 } from "../../../../../lib/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_ORG_ID = "preview";
const DEFAULT_TOP_K = 6;
const DEFAULT_SCORE_THRESHOLD = 0.02;

let seeded = false;
async function ensureAuthoritiesSeeded() {
  if (seeded) return;
  const store = getDefaultCognitionStore("securities");
  const size = await store.size();
  if (size === 0) {
    await store.addBatch(ONTARIO_EMD_AUTHORITIES);
  }
  seeded = true;
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

const TASK_PROMPTS: Record<string, string> = {
  "om-review": `Review this offering memorandum for compliance with Ontario securities rules.

Produce the full structured output as specified in your instructions:
1. Required Disclosures Checklist (table with Status: FOUND / PARTIAL / MISSING)
2. Gap Memo (paragraph per PARTIAL/MISSING item with rule citations)
3. Risk Flags (forward-looking statements, missing rights of action, marketing claims)

Use structured citations [c1], [c2], etc. for every rule reference.
Be thorough — this memo will be reviewed by a CCO.`,

  "kyc-gap-check": `Review the uploaded client file for KYC/AML compliance gaps under NI 31-103 Part 13 and FINTRAC requirements.

For each required KYC element, assess whether the file is complete, incomplete, or missing.
Cite the specific regulatory requirement for each gap found.`,

  "marketing-signoff": `Review this marketing material for compliance with NI 81-102 Part 15 (sales communications and prohibited representations).

Flag any misleading statements, missing risk disclosures, or prohibited representations.
For each flag, cite the specific rule and suggest corrective language.`,

  "response-memo": `Draft a response memo addressing the regulatory inquiry or deficiency letter.

Structure the response point-by-point, addressing each concern raised.
Cite supporting authorities and reference the client's existing compliance documentation.`,
};

/** Lead persona picked by the task type. Each task gets a dedicated system
 *  prompt — previously all four tasks fell through to om-reviewer. */
const TASK_LEADS: Record<string, PersonaId> = {
  "om-review": "om-reviewer",
  "kyc-gap-check": "kyc-reviewer",
  "marketing-signoff": "marketing-reviewer",
  "response-memo": "response-drafter",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const matterStore = getDefaultMatterStore();
  const matter = matterStore.get(matterId);

  if (!matter) {
    return new Response("Matter not found", { status: 404 });
  }

  let body: { taskType?: string } = {};
  try {
    body = (await req.json()) as { taskType?: string };
  } catch {
    // Use matter's task type
  }

  const taskType = body.taskType ?? matter.taskType;
  const userMessage = TASK_PROMPTS[taskType] ?? TASK_PROMPTS["om-review"]!;
  const leadPersona: PersonaId = TASK_LEADS[taskType] ?? "om-reviewer";

  // Seed authorities
  await ensureAuthoritiesSeeded();

  // Retrieve relevant snippets filtered by matter scope
  const cognitionStore = getDefaultCognitionStore("securities");
  let retrievedSnippets: RetrievedSnippet[] = [];
  try {
    const results = await cognitionStore.retrieve({
      query: userMessage,
      topK: DEFAULT_TOP_K,
      organizationId: PREVIEW_ORG_ID,
      scoreThreshold: DEFAULT_SCORE_THRESHOLD,
      jurisdiction: matter.jurisdiction,
      registrationCategory: matter.registrationCategory,
    });
    retrievedSnippets = results.map(toRetrievedSnippet);
  } catch {
    retrievedSnippets = [];
  }

  // Write audit entry for the query
  const auditStore = getDefaultAuditStore();
  auditStore.append(matterId, {
    matterId,
    organizationId: PREVIEW_ORG_ID,
    actor: leadPersona,
    action: "query",
    inputHash: sha256(userMessage),
    authoritiesUsed: retrievedSnippets.map((s) => s.id),
    outputHash: null,
    judgeVerdict: null,
    inputContent: userMessage,
    outputContent: null,
  });

  // Write audit entry for retrieval
  if (retrievedSnippets.length > 0) {
    auditStore.append(matterId, {
      matterId,
      organizationId: PREVIEW_ORG_ID,
      actor: "system",
      action: "retrieval",
      inputHash: sha256(userMessage),
      authoritiesUsed: retrievedSnippets.map((s) => s.id),
      outputHash: sha256(retrievedSnippets.map((s) => s.title).join(",")),
      judgeVerdict: null,
      inputContent: `Retrieved ${retrievedSnippets.length} authorities for ${matter.jurisdiction} / ${matter.registrationCategory}`,
      outputContent: retrievedSnippets.map((s) => s.title).join("\n"),
    });
  }

  // Build agent context (framework-agnostic — we're in securities mode)
  const context: AgentContext = {
    control: null,
    frameworkScope: [],
    organizationId: PREVIEW_ORG_ID,
    retrievedSnippets,
  };

  // Update matter status
  matterStore.updateStatus(matterId, "in-review");

  // Seed a user-turn into the transcript so the timeline starts with the
  // kickoff message. Every subsequent agent turn is appended as the loop
  // emits it.
  const transcriptStore = getDefaultTranscriptStore();
  transcriptStore.append({
    matterId,
    from: "user",
    content: userMessage,
    kind: "user-message",
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullOutput = "";
      let lastVerdict: string | null = null;
      let rounds = 0;

      // Per-round state for transcript persistence
      let currentPersona: PersonaId | null = null;
      let currentBuffer = "";
      let currentRound = 0;
      let currentKind: TurnKind = "agent-draft";
      let lastLeadTurnId: string | undefined;

      const flushCurrentTurn = () => {
        if (!currentPersona || !currentBuffer.trim()) {
          currentBuffer = "";
          return;
        }
        const turn = transcriptStore.append({
          matterId,
          from: currentPersona,
          replyTo: currentKind === "judge-verdict" ? lastLeadTurnId : undefined,
          round: currentRound,
          content: currentBuffer,
          kind: currentKind,
          verdict:
            currentKind === "judge-verdict" && lastVerdict
              ? (lastVerdict as "READY_TO_SUBMIT" | "ITERATE" | "REWRITE")
              : undefined,
        });
        if (currentKind === "agent-draft" || currentKind === "agent-reply") {
          lastLeadTurnId = turn.id;
        }
        currentBuffer = "";
      };

      try {
        const generator = runAgentLoop(context, userMessage, {
          maxRounds: 3,
          leadPersona,
        });

        for await (const event of generator) {
          controller.enqueue(encoder.encode(sseFrame(event)));

          if (event.type === "round-started") {
            // Close out the previous turn before starting the next.
            flushCurrentTurn();
            currentPersona = event.persona;
            currentRound = event.round;
            currentKind =
              event.persona === "judge"
                ? "judge-verdict"
                : event.persona === leadPersona
                  ? "agent-draft"
                  : "agent-reply";
          } else if (event.type === "text-delta") {
            fullOutput += event.delta;
            currentBuffer += event.delta;
          } else if (event.type === "citations" && event.redactedText) {
            // Replace buffer with redacted prose (strips fenced citations
            // + tool-call blocks). Transcript holds the clean render.
            currentBuffer = event.redactedText;
          } else if (event.type === "verdict-final") {
            lastVerdict = event.verdict;
          } else if (event.type === "loop-done") {
            rounds = event.totalRounds;
            if (event.finalVerdict) lastVerdict = event.finalVerdict;
            flushCurrentTurn();
          }
        }
        // Defensive flush in case the loop yielded events after loop-done.
        flushCurrentTurn();

        // Write generation audit entry
        auditStore.append(matterId, {
          matterId,
          organizationId: PREVIEW_ORG_ID,
          actor: leadPersona,
          action: "generation",
          inputHash: sha256(userMessage),
          authoritiesUsed: retrievedSnippets.map((s) => s.id),
          outputHash: sha256(fullOutput),
          judgeVerdict: lastVerdict,
          inputContent: `${rounds} round(s) via judge loop (lead: ${leadPersona})`,
          outputContent: fullOutput.slice(0, 2000),
        });

        // Update matter status based on verdict
        if (lastVerdict === "READY_TO_SUBMIT") {
          matterStore.updateStatus(matterId, "complete");
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
