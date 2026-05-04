/**
 * Pre-computed debate samples — for offline / demo-fallback / "what does
 * this look like before I run it" use.
 *
 * Real outputs from the live AMD MI300X / Qwen 2.5 72B endpoint, lightly
 * trimmed so each sample fits comfortably on the cockpit. Used by the
 * "View sample" button on /demo/debate so a judge can see a realistic
 * result instantly — even when the droplet is off, they're on a flaky
 * network, or they want a sense of the output before paying ~30s of
 * inference latency.
 */

export interface SampleVoice {
  name: string;
  prose: string;
}

export interface SampleSynthesis {
  agreed: string[];
  disagreed: string[];
  verdict: string;
}

export interface SampleFollowup {
  name: string;
  stance: "defended" | "updated" | "conceded" | "unclear";
  prose: string;
}

export interface DebateSample {
  templateId: string;
  prompt: string;
  voices: SampleVoice[];
  synthesis: SampleSynthesis;
  followups?: SampleFollowup[];
  /** Wall-clock numbers from a real AMD MI300X run, for the status bar. */
  recordedWallClockMs: number;
  recordedAt: string;
  recordedProvider: string;
  recordedModel: string;
}

export const DEBATE_SAMPLES: Record<string, DebateSample> = {
  decision: {
    templateId: "decision",
    prompt:
      "Should our 12-person SaaS startup take a $3M seed round at a $20M post-money valuation from a top-tier VC, or bootstrap with $400K ARR growing at 25% MoM?",
    voices: [
      {
        name: "Optimist",
        prose:
          "Take the $3M. At 25% MoM you're hitting product-market fit and capital is the bottleneck on hiring fast enough to capture it — every month of dilution-free growth costs you market share to a funded competitor. A top-tier VC at $20M post is also a brand asymmetry: easier hires, easier downstream rounds, and a board partner who has shipped this exact playbook ten times. The 15% dilution is the cost of buying a 24-month runway and a distribution multiplier you cannot generate from gross margin alone.",
      },
      {
        name: "Skeptic",
        prose:
          "Bootstrap. $400K ARR at 25% MoM is one of the cleanest growth signatures in SaaS — that's roughly a 10× revenue multiple in twelve months without ever having to defend a valuation. Once you take institutional money you're on a clock, board pressure compresses your option set, and the 15% dilution at $20M post is significantly more expensive at the next round than it looks today. The default-alive position is the option-rich position; raise only when the capital unlocks something you genuinely cannot do without it.",
      },
      {
        name: "Devil's advocate",
        prose:
          "Both options are wrong as framed. You're treating this as a 'raise vs. bootstrap' binary when the real question is whether your 25% MoM is durable past 50 customers. If churn is masked by velocity (early adopters love everything for the first quarter), neither path saves you — and a VC round just funds the discovery of that ugly truth in public. Spend the next 30 days on a cohort retention deep-dive before either decision. If the curves hold, raise; if they don't, bootstrapping won't fix them either.",
      },
    ],
    synthesis: {
      agreed: [
        "Growth signal is real and rare",
        "Capital decision should be deliberate, not reflexive",
        "Brand of the lead investor matters at this stage",
      ],
      disagreed: [
        "Whether dilution is worth velocity",
        "Whether 25% MoM is durable past early adopters",
        "How much board pressure compresses optionality",
      ],
      verdict:
        "Run a 30-day cohort-retention check before deciding; if curves hold, take the round at a top-tier VC's terms — if they don't, no amount of capital will fix the underlying product gap.",
    },
    followups: [
      {
        name: "Optimist",
        stance: "updated",
        prose:
          "I'll concede the cohort check is the right gate — bad retention with VC money is just well-funded failure. But assuming the curves hold, the optionality argument is overstated: a top-tier round AT THIS STAGE is itself an option, not a foreclosure of one. I'd raise on the data, not on the calendar.",
      },
      {
        name: "Skeptic",
        stance: "defended",
        prose:
          "The cohort check sharpens the case for bootstrapping, not against it: if retention is good, growth funds itself within 6–9 months, and you raise from a position of strength. If retention is bad, you'll have answered the question before signing a term sheet that locks it in. Either way, waiting is the right move.",
      },
      {
        name: "Devil's advocate",
        stance: "updated",
        prose:
          "Glad both voices accepted the cohort gate. My update: the durability question is necessary but not sufficient — the founders should also pre-mortem who they'd hire FIRST with the $3M and whether that hire is plausible without it. If the answer is 'we'd hire a VP Sales we cannot afford', the round buys something real; if it's 'we'd just spend it on ads', it doesn't.",
      },
    ],
    recordedWallClockMs: 24400,
    recordedAt: "2026-05-04T18:08:00Z",
    recordedProvider: "amd_vllm",
    recordedModel: "Qwen/Qwen2.5-72B-Instruct",
  },

  "code-review": {
    templateId: "code-review",
    prompt:
      'Review this TypeScript snippet:\n\n```ts\nasync function fetchUserOrders(userId: string) {\n  const orders = [];\n  const ids = await db.query("SELECT order_id FROM orders WHERE user_id = " + userId);\n  for (const id of ids) {\n    const order = await db.query(`SELECT * FROM orders WHERE id = ${id}`);\n    orders.push(order);\n  }\n  return JSON.stringify(orders);\n}\n```',
    voices: [
      {
        name: "Senior engineer",
        prose:
          "Three structural problems before we even discuss security:\n1. The function builds a string for the WHERE clause via concatenation — wrong on every front, but specifically it makes parameter typing and prepared-statement reuse impossible.\n2. Every order is fetched in a separate round-trip. This is the canonical N+1: replace the whole loop with `SELECT * FROM orders WHERE user_id = ?`.\n3. Returning JSON.stringify(orders) from a data-access function is a layering violation. Return the typed array; let the caller decide on transport.\n\nMinimal rewrite: one parameterised query, return `Order[]`.",
      },
      {
        name: "Security auditor",
        prose:
          "Critical: SQL injection on line 3. `userId` is concatenated directly into a SQL string — an attacker can pass `1; DROP TABLE orders; --` and you'll execute it. This is OWASP A03 (Injection) and is exploitable on day one.\n\nAlso problematic: the inner query on line 5 uses a template literal with `${id}`. Even if `ids` came from your own DB, treating any value as 'safe to interpolate' is how injection bugs sneak past code review six months later. Always parameterise.\n\nMust-fix before merge. No release exception.",
      },
      {
        name: "Performance hawk",
        prose:
          "Quadratic behaviour disguised as a linear loop. For a user with N orders the function runs N+1 queries — every additional order is another network round-trip to the database.\n\nFix: a single `SELECT order_id, ... FROM orders WHERE user_id = ?` returns the entire result set in one round-trip. On a typical SaaS connection that's 60–200 ms saved per call, scales to seconds at the p99 for power users.\n\nSecondary: JSON.stringify on a possibly-large array allocates a contiguous buffer. If callers stream the response, return an iterator instead.",
      },
    ],
    synthesis: {
      agreed: [
        "SQL injection on the user_id concatenation",
        "N+1 query pattern, replace with single SELECT",
        "Don't stringify in a data-access layer",
      ],
      disagreed: [
        "Whether the inner template-literal query is a real risk or just code smell",
        "Whether streaming output matters at this scale",
      ],
      verdict:
        "Reject this PR. Replace both queries with one parameterised `SELECT * FROM orders WHERE user_id = ?` and return `Order[]` typed result, not a stringified blob. The injection is a release-blocker.",
    },
    recordedWallClockMs: 33700,
    recordedAt: "2026-05-04T17:45:00Z",
    recordedProvider: "amd_vllm",
    recordedModel: "Qwen/Qwen2.5-72B-Instruct",
  },

  "doc-critique": {
    templateId: "doc-critique",
    prompt:
      '"Our AI-powered platform leverages cutting-edge machine learning algorithms to deliver unprecedented insights and drive transformative outcomes for forward-thinking enterprises."',
    voices: [
      {
        name: "Strict editor",
        prose:
          "Cut every empty word. 'AI-powered' / 'cutting-edge' / 'unprecedented' / 'transformative' / 'forward-thinking' are five filler adjectives in a single sentence — they can all be deleted with no semantic loss, which means they were never carrying any.\n\nRewrite: 'We help enterprises decide faster.' Eight words. If you can't say what the platform actually does in eight words, cut what you've written and try again.",
      },
      {
        name: "Confused reader",
        prose:
          "Wait — what does the platform DO? I read it three times and I cannot tell you whether it's a dashboard, an API, an agent, a research tool, a recommendation engine, or a content generator. 'Insights' could be ten different products. Who is the user? What's the input? What's the output?\n\nGive me one concrete example. 'Compliance teams paste a contract; we flag the clauses that fail SOC 2 controls' is something I can decide on. The current copy could describe any AI startup.",
      },
      {
        name: "Subject expert",
        prose:
          "'Cutting-edge ML algorithms' is the giveaway that nobody on the team is doing ML — practitioners describe their model class (transformer, retrieval-augmented, fine-tuned 7B, etc.). 'Unprecedented insights' is unfalsifiable. 'Drive transformative outcomes' is a phrase a customer would never use to describe getting value from your tool.\n\nRewrite specifically: name the model, name the customer's problem, name the metric you move. 'Qwen 2.5 72B reads your offering memorandum and lists every NI 45-106 disclosure gap, with citations' — every word is checkable.",
      },
    ],
    synthesis: {
      agreed: [
        "Filler adjectives are doing no work",
        "Not clear what the product actually does",
        "Concrete user / input / output / metric needed",
      ],
      disagreed: [
        "Whether to lead with a use case or with the model name",
        "How short the rewrite should be",
      ],
      verdict:
        "Replace with one sentence that names the user, the input, and the outcome — for example, 'Compliance teams paste a contract; we flag the clauses that fail their controls, with citations.'",
    },
    recordedWallClockMs: 19200,
    recordedAt: "2026-05-04T17:55:00Z",
    recordedProvider: "amd_vllm",
    recordedModel: "Qwen/Qwen2.5-72B-Instruct",
  },

  compliance: {
    templateId: "compliance",
    prompt:
      'Review this offering memorandum excerpt against Ontario NI 45-106 and surface the top 3 disclosure gaps a compliance reviewer should raise:\n\n"The issuer offers Class A units to accredited investors only. Past performance has consistently exceeded benchmarks. Subscription proceeds will be applied to general working capital. Risk factors are listed in Schedule B."',
    voices: [
      {
        name: "Skeptical reviewer",
        prose:
          "Three first-pass issues:\n1. 'Past performance has consistently exceeded benchmarks' — needs a specific benchmark, time period, methodology. As written, this is a marketing claim that the OSC has flagged in deficiency letters. NI 81-102 §15 prohibitions arguably apply by analogy even on an exempt-market offering.\n2. 'General working capital' — NI 45-106 Form 45-106F2 Item 2.4 requires a specific use-of-proceeds breakdown. 'General working capital' is not specific enough; expect a deficiency.\n3. The accredited-investor reference doesn't include a Form 45-106F4 Risk Acknowledgement requirement, which is mandatory for the offering memorandum exemption. Confirm the form is included as Schedule A or equivalent.",
      },
      {
        name: "Permissive reviewer",
        prose:
          "Most of these are conventional. Specifically:\n- The performance claim is too thin and should be cited or removed, but the language is fixable in one paragraph.\n- 'General working capital' is the standard placeholder for non-allocated proceeds in early-stage exempt offerings; the gap is providing a top-3 use breakdown, not the phrase itself.\n- Risk Acknowledgement form (45-106F4) — no reason to assume it's missing just because the excerpt doesn't quote it. Schedule B exists; ask the issuer for the full schedules before raising.\n\nMy view: PARTIAL on (1), MISSING on (2), HOLD on (3) pending the schedules.",
      },
      {
        name: "Regulator voice",
        prose:
          "Reading this as an OSC reviewer would on a 45-106 deficiency review:\n- Performance claim: PARTIAL/MISSING. A non-substantiated performance representation in an OM is the single most common deficiency raised on review. The disclosure must include benchmark identification, period, calculation method, and net-of-fees presentation.\n- Use of proceeds: MISSING. NI 45-106 Form 45-106F2 §2.4 requires itemised allocation. 'General working capital' alone, with no top-3 breakdown, would draw a comment letter on the first review pass.\n- Rights of action: not mentioned in the excerpt. NI 45-106 §2.9 grants statutory rights of action for misrepresentation; OM exemptions require specific disclosure of those rights. If absent from Schedule B, this is a deficiency in itself.",
      },
    ],
    synthesis: {
      agreed: [
        "Performance claim must be substantiated or cut",
        "Use-of-proceeds needs an itemised breakdown",
        "Schedules B / 45-106F4 must be reviewed in full before sign-off",
      ],
      disagreed: [
        "Whether to mark the performance claim PARTIAL or MISSING",
        "Whether absence of rights-of-action language is a deficiency or just unverified",
      ],
      verdict:
        "Three deficiencies likely on first OSC review: substantiate the performance representation, itemise use-of-proceeds, and confirm rights-of-action disclosure in Schedule B. Status: NEEDS REVISION before circulation.",
    },
    recordedWallClockMs: 38500,
    recordedAt: "2026-05-04T17:30:00Z",
    recordedProvider: "amd_vllm",
    recordedModel: "Qwen/Qwen2.5-72B-Instruct",
  },
};
