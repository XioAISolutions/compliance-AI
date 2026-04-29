/**
 * 1000-turn consolidation integration test.
 *
 * Simulates competing agents writing lesson candidates through the
 * sidecar over many turns. The corpus is intentionally narrow (a few
 * "themes", each with paraphrases and one contradiction per theme)
 * so reinforce/supersede must dominate over insert.
 *
 * Asserts:
 *   - store size stays bounded relative to themes (not turns)
 *   - every theme's contradiction landed as a supersession
 *   - reinforce ratio > 0.5
 *   - sidecar p99 < 200ms (we approximate with average + slow-count guard)
 */

import { describe, it, expect } from "vitest";
import { CognitionSidecar } from "../sidecar.js";
import { InMemoryLessonStore } from "../in-memory-store.js";
import { DeterministicEmbedder } from "../embedding.js";
import { InMemoryMetrics } from "../metrics.js";
import type { LessonCandidate } from "../types.js";

interface Theme {
  base: string;
  paraphrases: string[];
  contradiction: string;
}

const THEMES: Theme[] = [
  {
    base: "Ontario EMD reviewers must verify NI 33-109 individual registration disclosure.",
    paraphrases: [
      "Ontario EMD reviewers must verify the NI 33-109 individual registration disclosure carefully.",
      "Reviewers handling Ontario EMD files always verify NI 33-109 disclosure data on file.",
      "EMD reviewers in Ontario verify NI 33-109 individual registration disclosure entries.",
    ],
    contradiction:
      "Ontario EMD reviewers do not verify NI 33-109 individual registration disclosure entries directly.",
  },
  {
    base: "Marketing decks for accredited investors must label past performance prominently.",
    paraphrases: [
      "Marketing decks for accredited investors prominently label past performance disclosures.",
      "Decks for accredited investors must clearly label past performance figures.",
      "Investor decks for accredited persons need a prominent past performance label.",
    ],
    contradiction:
      "Marketing decks for accredited investors must not include past performance disclaimers.",
  },
  {
    base: "Issuers file the Form 45-106F1 report within 10 days of distribution.",
    paraphrases: [
      "Issuers file the Form 45-106F1 within 10 days of any distribution.",
      "Form 45-106F1 reports are filed within 10 days of the distribution event.",
      "An issuer files Form 45-106F1 within 10 days after each distribution.",
    ],
    contradiction:
      "Issuers file the Form 45-106F1 report within 30 days of distribution.",
  },
  {
    base: "KYC files require documented source-of-funds for high-risk clients.",
    paraphrases: [
      "KYC files for high-risk clients require documented source-of-funds.",
      "Files for high-risk clients require documented source-of-funds in KYC.",
      "Documented source-of-funds for high-risk KYC clients is required.",
    ],
    contradiction:
      "KYC files do not require documented source-of-funds for high-risk clients.",
  },
  {
    base: "Beneficial-owner certification is mandatory at account onboarding.",
    paraphrases: [
      "Beneficial-owner certification is required at account onboarding for all clients.",
      "At account onboarding the beneficial-owner certification is mandatory.",
      "Account onboarding requires beneficial-owner certification on the corporate signing form.",
    ],
    contradiction:
      "Beneficial-owner certification is not mandatory at account onboarding.",
  },
];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

// Deterministic Mulberry32 RNG so the test is reproducible.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("1000-turn consolidation", () => {
  it("keeps store bounded and supersedes contradictions correctly", async () => {
    const store = new InMemoryLessonStore();
    const embedder = new DeterministicEmbedder();
    const metrics = new InMemoryMetrics();
    const sidecar = new CognitionSidecar(store, embedder, {
      // The deterministic 256-dim hash embedder is noisier than a
      // learned model — a paraphrase of the same theme typically lands
      // around cosine 0.6–0.8 with the original. Threshold of 0.55
      // gets us reliable consolidation on theme paraphrases without
      // collapsing distinct themes (verified empirically on the test
      // corpus below). Production should use a learned embedder and
      // can dial this back up to ~0.85.
      similarityThreshold: 0.55,
      metrics,
    });
    const rng = mulberry32(42);

    const TURNS = 1000;
    const CONTRADICTION_TURN_RATIO = 0.06; // ~6% of turns introduce a contradiction
    const contradictionsBySeen = new Set<number>();

    for (let i = 0; i < TURNS; i++) {
      // Pick a theme, with a small prior on theme reuse so reinforcement
      // dominates over insert (matches real-world session activity).
      const themeIdx = Math.floor(rng() * THEMES.length);
      const theme = THEMES[themeIdx]!;

      let content: string;
      if (
        rng() < CONTRADICTION_TURN_RATIO &&
        !contradictionsBySeen.has(themeIdx) &&
        i > 30 // give the base a few reinforcements first
      ) {
        content = theme.contradiction;
        contradictionsBySeen.add(themeIdx);
      } else if (i === 0 || rng() < 0.05) {
        // First touch on theme: use the base.
        content = theme.base;
      } else {
        content = pick(rng, [theme.base, ...theme.paraphrases]);
      }

      const cand: LessonCandidate = {
        organizationId: "org-1",
        content,
        source: {
          sessionId: `session-${i % 50}`,
          agent: pick(rng, ["drafter", "judge", "reviewer", "evidence"]),
          observedAt: new Date(),
        },
        tags: ["theme:" + themeIdx],
      };

      const result = await sidecar.consolidate(cand);
      expect(["inserted", "reinforced", "superseded"]).toContain(result.action);
    }

    const snap = metrics.snapshot();
    const all = await store.list("org-1", { status: "all" });
    const active = await store.list("org-1");

    // Bounded: store size scales with themes, NOT turns. With 5 themes
    // and 1000 turns we want active << TURNS. The deterministic
    // embedder doesn't merge every paraphrase variant, so we accept up
    // to 4× themes as the active ceiling — still a 50× compression
    // over naive insert (which would yield ~1000 rows).
    expect(active.length).toBeLessThanOrEqual(THEMES.length * 4);
    expect(active.length).toBeLessThan(TURNS / 25);
    // Total row count, including superseded history, should also stay
    // well bounded relative to turns.
    expect(all.length).toBeLessThan(TURNS / 10);

    // Every theme that introduced a contradiction must show one supersession.
    expect(snap.supersededCount).toBeGreaterThanOrEqual(contradictionsBySeen.size);

    // Reinforce-vs-insert ratio: with paraphrases dominating the corpus,
    // reinforcements should outnumber fresh inserts by a wide margin.
    expect(snap.reinforceRatio).toBeGreaterThan(0.85);

    // Sidecar latency budget: average should be well under 200ms.
    expect(snap.averageSidecarMs).toBeLessThan(200);
    // Slow-call ceiling: at most a small handful of outliers.
    expect(snap.sidecarSlowCount).toBeLessThan(TURNS * 0.05);
  }, 30_000);
});
