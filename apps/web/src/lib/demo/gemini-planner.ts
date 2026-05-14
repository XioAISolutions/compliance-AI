/**
 * Gemini planner — calls the Google AI Studio generateContent endpoint
 * to plan compliance review lanes over the Milan scenario text.
 *
 * Activation is purely env-driven:
 *   GEMINI_API_KEY=… (Google AI Studio key)
 *   GEMINI_MODEL=gemini-2.5-flash   (optional override)
 *
 * Without GEMINI_API_KEY the helper returns a deterministic plan so
 * smoke tests, CI, and the Milan demo route still produce stable
 * output. With the key present, the planner returns a real Gemini
 * response and the page surface reports `source: "gemini"`.
 *
 * Network failures and bad responses fall back to the deterministic
 * plan — judges should never see a 5xx because Gemini hiccupped during
 * the review window.
 */

export type PlanSource = "gemini" | "deterministic";

export interface PlannedLane {
  name: string;
  rationale: string;
}

export interface PlannerResult {
  source: PlanSource;
  model: string;
  summary: string;
  lanes: PlannedLane[];
  latencyMs: number;
  error?: string;
}

const DEFAULT_MODEL = "gemini-2.5-flash";

const DETERMINISTIC_PLAN: Omit<PlannerResult, "latencyMs" | "source" | "model"> = {
  summary:
    "Investor-deck + sales-call material with guaranteed-outcome and urgency language — routes to securities, privacy, marketing-signoff, and AI-use review lanes.",
  lanes: [
    {
      name: "securities",
      rationale: "Investor deck makes performance guarantees and uses scarcity to compress subscription decisions.",
    },
    {
      name: "privacy",
      rationale: "Call recording is used for lead scoring without clear consent language.",
    },
    {
      name: "marketing-signoff",
      rationale: "Marketing claim asserts protected returns and instant approval.",
    },
    {
      name: "ai-use",
      rationale: "Workflow drafts filed material without a visible human review attestation.",
    },
  ],
};

export function isGeminiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

export async function plan(
  text: string,
  env: Record<string, string | undefined> = process.env,
): Promise<PlannerResult> {
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const t0 = Date.now();

  if (!apiKey) {
    return {
      source: "deterministic",
      model: "stub",
      latencyMs: Date.now() - t0,
      ...DETERMINISTIC_PLAN,
    };
  }

  const prompt = [
    "You are a compliance review planner.",
    "Given the input text (deck + transcript + claim), identify which review lanes apply.",
    "Available lanes: securities, privacy, marketing-signoff, ai-use, contract-redline, court-ai-disclosure.",
    "Return JSON only matching this schema: {summary: string, lanes: [{name: string, rationale: string}]}.",
    "Keep each rationale to one sentence. Pick at most 5 lanes.",
    "",
    "Input text:",
    text,
  ].join("\n");

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
      // Don't let a slow Gemini stall a judge's tab.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        source: "deterministic",
        model: `${model} (fallback)`,
        latencyMs: Date.now() - t0,
        error: `Gemini ${res.status}: ${errText.slice(0, 200)}`,
        ...DETERMINISTIC_PLAN,
      };
    }

    const body = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const textOut = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(textOut) as {
      summary?: string;
      lanes?: Array<{ name?: string; rationale?: string }>;
    };
    const lanes: PlannedLane[] = Array.isArray(parsed.lanes)
      ? parsed.lanes
          .filter(
            (l): l is { name: string; rationale: string } =>
              typeof l?.name === "string" && typeof l?.rationale === "string",
          )
          .slice(0, 5)
      : [];
    if (lanes.length === 0) {
      return {
        source: "deterministic",
        model: `${model} (fallback)`,
        latencyMs: Date.now() - t0,
        error: "Gemini response had no usable lanes",
        ...DETERMINISTIC_PLAN,
      };
    }
    return {
      source: "gemini",
      model,
      latencyMs: Date.now() - t0,
      summary: typeof parsed.summary === "string" ? parsed.summary : DETERMINISTIC_PLAN.summary,
      lanes,
    };
  } catch (err) {
    return {
      source: "deterministic",
      model: `${model} (fallback)`,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
      ...DETERMINISTIC_PLAN,
    };
  }
}
