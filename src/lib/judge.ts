import { Ollama } from "ollama";
import { config } from "./config";

/**
 * LLM-as-judge: a stricter second opinion on top of the lexical verifier.
 *
 * The lexical check in `verify.ts` catches obvious hallucinations (citation
 * stuck on a sentence that shares no vocabulary with the chunk). But it can
 * be fooled when the model paraphrases heavily or when the claim and chunk
 * share high-frequency compliance jargon ("personal information", "must")
 * without the chunk actually supporting the claim.
 *
 * This module asks the local chat model to read a single (claim, chunk)
 * pair and answer a binary "is this claim supported?" question with a
 * short reasoning trace. Runs entirely locally — no data leaves the box.
 *
 * Cost model: one extra chat call per citation. Callers should gate usage
 * (e.g. only judge citations the lexical verifier already flagged, or only
 * when an eval run explicitly asks for it).
 */

const ollama = new Ollama({ host: config.ollama.baseUrl });

export interface JudgeResult {
  supported: boolean;
  confidence: number;     // 0..1
  reasoning: string;      // one-sentence rationale from the model
}

const JUDGE_SYSTEM = `You are an expert compliance auditor. You are given one CLAIM and one SOURCE passage.

Decide whether the SOURCE directly supports the CLAIM. Be strict:
- "supported" means a reader of the SOURCE alone could draw the CLAIM with confidence.
- "not supported" means the SOURCE is off-topic, contradicts the CLAIM, or only tangentially related.
- Paraphrase is fine. Inference beyond what the SOURCE states is NOT supported.

Respond with a single line of compact JSON:
{"supported": true|false, "confidence": 0.0-1.0, "reasoning": "<one short sentence>"}
No preamble, no markdown, no code fences.`;

function parseJudge(raw: string): JudgeResult {
  // Models sometimes wrap the JSON in prose or code fences — be forgiving.
  const jsonMatch = raw.match(/\{[^{}]*"supported"[^{}]*\}/);
  if (!jsonMatch) {
    return { supported: false, confidence: 0, reasoning: `unparseable judge output: ${raw.slice(0, 80)}` };
  }
  try {
    const obj = JSON.parse(jsonMatch[0]);
    const supported = obj.supported === true;
    const confidence = typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : supported ? 0.6 : 0.4;
    const reasoning = typeof obj.reasoning === "string" ? obj.reasoning.slice(0, 240) : "";
    return { supported, confidence, reasoning };
  } catch {
    return { supported: false, confidence: 0, reasoning: `invalid JSON: ${jsonMatch[0].slice(0, 80)}` };
  }
}

export async function judgeClaim(claim: string, chunkContent: string): Promise<JudgeResult> {
  if (!claim.trim()) {
    return { supported: true, confidence: 1, reasoning: "empty claim" };
  }
  try {
    const res = await ollama.chat({
      model: config.ollama.chatModel,
      messages: [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: `CLAIM: ${claim}\n\nSOURCE:\n${chunkContent.slice(0, 2000)}` },
      ],
      options: { temperature: 0, num_predict: 160 },
    });
    return parseJudge(res.message.content.trim());
  } catch (err: any) {
    return { supported: false, confidence: 0, reasoning: `judge error: ${err?.message ?? "unknown"}` };
  }
}

