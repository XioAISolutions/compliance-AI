/**
 * Auto-verify helper — runs the citation verifier and enqueues a single
 * SSE frame with per-citation results + summary. Extracted from the
 * review route so it can be unit-tested without spinning up the full
 * judge-loop + model-provider stack.
 *
 * The helper is best-effort: if the verifier throws, it logs and
 * returns without enqueueing a frame. The review is already streamed at
 * that point; the user can still click "Verify citations" manually.
 */

import {
  defaultVerifier,
  getDefaultCognitionStore,
  summarizeVerifications,
  type VerifierCitation,
} from "@compliance-ai/cognition";

/** Minimal citation shape auto-verify needs. Mirrors the agents Citation. */
export interface AutoVerifyCitation {
  id: string;
  authorityId: string;
  section: string;
  quote?: string;
  jurisdiction?: string;
  sourceType?: string;
  authorityDate?: string;
  pinpoint?: string;
  confidence?: number;
}

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function emitAutoVerifySseFrame(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  citations: readonly AutoVerifyCitation[],
  organizationId: string,
): Promise<void> {
  if (citations.length === 0) return;
  try {
    const verifier = defaultVerifier(getDefaultCognitionStore(), organizationId);
    const payload: VerifierCitation[] = citations.map((c) => ({
      id: c.id,
      authorityId: c.authorityId,
      section: c.section,
      quote: c.quote,
      jurisdiction: c.jurisdiction,
      sourceType: c.sourceType,
      authorityDate: c.authorityDate,
      pinpoint: c.pinpoint,
      confidence: c.confidence,
    }));
    const results = await verifier.verifyBatch(payload);
    const summary = summarizeVerifications(results);
    controller.enqueue(
      encoder.encode(sseFrame({ type: "verifications", summary, results })),
    );
  } catch (err) {
    console.warn(
      `[auto-verify] verifier failed:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
