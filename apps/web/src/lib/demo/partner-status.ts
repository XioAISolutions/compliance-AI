/**
 * Partner integration status — reports which sponsor APIs are wired
 * for live calls vs. running on the deterministic Milan stub. The
 * /demo/milan page renders this so judges can see at a glance which
 * partners are "live" against the deployment they're looking at.
 *
 * Activation is purely env-var driven so a Vultr deploy with the
 * sponsor keys present lights up automatically; without keys, the
 * deterministic path still ships and the smoke suite stays
 * credential-free.
 */
export type PartnerId = "vultr" | "gemini" | "speechmatics" | "featherless";

export interface PartnerStatus {
  id: PartnerId;
  name: string;
  envVar: string | null;
  live: boolean;
  role: string;
}

export function getPartnerStatuses(
  env: Record<string, string | undefined> = process.env,
): PartnerStatus[] {
  return [
    {
      id: "vultr",
      name: "Vultr",
      // Vultr is presence-of-deploy, not a key — we mark it live when
      // the app is running on a Vultr host or when an explicit marker
      // env var is set in the deploy.
      envVar: "VULTR_DEPLOY",
      live: Boolean(env.VULTR_DEPLOY),
      role: "Enterprise compliance plane — regional, healthchecked, private.",
    },
    {
      id: "gemini",
      name: "Gemini",
      envVar: "GEMINI_API_KEY",
      live: Boolean(env.GEMINI_API_KEY),
      role: "Planner + multimodal reasoning over deck and transcript.",
    },
    {
      id: "speechmatics",
      name: "Speechmatics",
      envVar: "SPEECHMATICS_API_KEY",
      live: Boolean(env.SPEECHMATICS_API_KEY),
      role: "Voice intelligence — diarized transcripts feeding the proof workflow.",
    },
    {
      id: "featherless",
      name: "Featherless",
      envVar: "FEATHERLESS_API_KEY",
      live: Boolean(env.FEATHERLESS_API_KEY),
      role: "Open-weights inference for sovereign, auditable review lanes.",
    },
  ];
}
