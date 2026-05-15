/**
 * Featherless redliner — calls an open-weights chat-completion endpoint
 * on Featherless to draft safer-language redlines for the Milan
 * scenario. Used for sovereign / private review lanes where firms
 * cannot send claim text to a closed API.
 *
 * Activation is purely env-driven:
 *   FEATHERLESS_API_KEY=…
 *   FEATHERLESS_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct   (optional)
 *   FEATHERLESS_BASE_URL=https://api.featherless.ai/v1        (optional)
 *
 * Without FEATHERLESS_API_KEY the helper returns a deterministic
 * redline so smoke + judges-without-network still see stable output.
 * Network failures fall back to deterministic with the error captured.
 */

export type RedlineSource = "featherless" | "deterministic";

export interface RedlineEdit {
  before: string;
  after: string;
  reason: string;
}

export interface RedlineResult {
  source: RedlineSource;
  model: string;
  edits: RedlineEdit[];
  latencyMs: number;
  error?: string;
}

const DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";
const DEFAULT_BASE_URL = "https://api.featherless.ai/v1";

const DETERMINISTIC_EDITS: RedlineEdit[] = [
  {
    before: "Protected returns. Guaranteed performance — our model is risk-free.",
    after:
      "Performance varies with market conditions. Past results do not guarantee future returns. See section 4 of the OM for risk factors.",
    reason: "Replace guaranteed-outcome language with risk-qualified disclosure.",
  },
  {
    before: "Instant approval, no paperwork.",
    after:
      "Approval follows human compliance review per the firm's onboarding policy; processing time depends on completeness of the file.",
    reason: "Remove instant-approval framing; restore human review attestation.",
  },
  {
    before: "Limited spots remain in this round. Closing today.",
    after:
      "Allocation is finite and managed on a first-qualified basis. The current subscription window is open through the date noted in the offering documents.",
    reason: "Defuse urgency / scarcity compression of buyer judgment.",
  },
];

export function isFeatherlessConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.FEATHERLESS_API_KEY);
}

export async function redline(
  text: string,
  env: Record<string, string | undefined> = process.env,
): Promise<RedlineResult> {
  const apiKey = env.FEATHERLESS_API_KEY;
  const model = env.FEATHERLESS_MODEL ?? DEFAULT_MODEL;
  const baseUrl = env.FEATHERLESS_BASE_URL ?? DEFAULT_BASE_URL;
  const t0 = Date.now();

  if (!apiKey) {
    return {
      source: "deterministic",
      model: "stub",
      edits: DETERMINISTIC_EDITS,
      latencyMs: Date.now() - t0,
    };
  }

  const system = [
    "You are a compliance redliner.",
    "Rewrite risky claim sentences into safer, defensible language while preserving the original business intent.",
    "Output JSON only matching: {edits: [{before: string, after: string, reason: string}]}. Maximum 5 edits.",
  ].join(" ");

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        max_tokens: 512,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        source: "deterministic",
        model: `${model} (fallback)`,
        edits: DETERMINISTIC_EDITS,
        latencyMs: Date.now() - t0,
        error: `Featherless ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as { edits?: unknown };
    const edits: RedlineEdit[] = Array.isArray(parsed.edits)
      ? parsed.edits
          .filter(
            (e: unknown): e is RedlineEdit =>
              typeof e === "object" &&
              e !== null &&
              typeof (e as RedlineEdit).before === "string" &&
              typeof (e as RedlineEdit).after === "string" &&
              typeof (e as RedlineEdit).reason === "string",
          )
          .slice(0, 5)
      : [];
    if (edits.length === 0) {
      return {
        source: "deterministic",
        model: `${model} (fallback)`,
        edits: DETERMINISTIC_EDITS,
        latencyMs: Date.now() - t0,
        error: "Featherless response had no usable edits",
      };
    }
    return {
      source: "featherless",
      model,
      edits,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      source: "deterministic",
      model: `${model} (fallback)`,
      edits: DETERMINISTIC_EDITS,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
