/**
 * UCB1 + island samplers — pure algorithm, no I/O.
 *
 * Lifted in spirit from ASI-Evolve's `database/algorithms/` (Apache 2.0).
 * Their use case: select which prior experiment node to evolve next.
 * Our use case: rank a tenant's open controls — "which 5 should I prompt
 * the user to work on today?" — balancing exploration (controls touched
 * least) against exploitation (controls with high external pressure:
 * audit due date, recent auditor finding, recently-added evidence gap).
 *
 * UCB1 formula:
 *   ucb_i = mean_i + c * sqrt(ln(N_total) / n_i)
 *
 * In our adaptation `mean_i` is a "urgency score" (higher = more deserving of
 * attention) and `n_i` counts how many times the control has surfaced in a
 * recommendation. The exploration constant `c` defaults to sqrt(2), the
 * classic value from Auer et al. 2002.
 *
 * Island sampling (MAP-Elites flavor): partition candidates into "islands"
 * (here, by framework). Sample mostly within islands, occasionally migrate.
 * Stops the dashboard from over-recommending one framework at the expense of
 * the other three.
 */

export interface SamplerCandidate<T> {
  item: T;
  /** Higher = more deserving of attention (auditor-driven urgency). */
  urgencyScore: number;
  /** How many times this candidate has been surfaced previously. */
  surfaceCount: number;
}

export interface UCB1Options {
  /** Exploration constant. sqrt(2) ≈ 1.414 is the textbook default. */
  c?: number;
}

export function ucb1Score<T>(
  candidate: SamplerCandidate<T>,
  totalSurfaces: number,
  options: UCB1Options = {},
): number {
  const c = options.c ?? Math.SQRT2;
  if (candidate.surfaceCount === 0) {
    // Never-surfaced candidates always go first — pure exploration.
    return Number.POSITIVE_INFINITY;
  }
  const exploitation = candidate.urgencyScore;
  const exploration = c * Math.sqrt(Math.log(Math.max(totalSurfaces, 1)) / candidate.surfaceCount);
  return exploitation + exploration;
}

/**
 * Pick the top-N candidates by UCB1 score. Stable: ties broken by input order.
 */
export function ucb1Pick<T>(
  candidates: SamplerCandidate<T>[],
  n: number,
  options: UCB1Options = {},
): T[] {
  const totalSurfaces = candidates.reduce((sum, c) => sum + c.surfaceCount, 0);
  const scored = candidates.map((candidate, idx) => ({
    candidate,
    idx,
    score: ucb1Score(candidate, totalSurfaces, options),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });
  return scored.slice(0, n).map((s) => s.candidate.item);
}

export interface IslandSamplerOptions<T> extends UCB1Options {
  /** Function that maps a candidate to its island id. */
  islandOf: (item: T) => string;
  /** Probability of migrating between islands per pick. Default 0.1. */
  migrationRate?: number;
  /** Random function (injectable for tests). Default Math.random. */
  random?: () => number;
}

/**
 * Pick `n` candidates with island sampling: round-robin across islands, with
 * occasional random migration. Within each island UCB1 selects the next pick.
 */
export function islandPick<T>(
  candidates: SamplerCandidate<T>[],
  n: number,
  options: IslandSamplerOptions<T>,
): T[] {
  const random = options.random ?? Math.random;
  const migrationRate = options.migrationRate ?? 0.1;

  const byIsland = new Map<string, SamplerCandidate<T>[]>();
  for (const candidate of candidates) {
    const island = options.islandOf(candidate.item);
    const bucket = byIsland.get(island);
    if (bucket) bucket.push(candidate);
    else byIsland.set(island, [candidate]);
  }

  const islands = Array.from(byIsland.keys());
  if (islands.length === 0) return [];

  const totalSurfaces = candidates.reduce((sum, c) => sum + c.surfaceCount, 0);
  const picks: T[] = [];
  let nextIslandIdx = 0;

  while (picks.length < n) {
    const island =
      random() < migrationRate
        ? islands[Math.floor(random() * islands.length)]
        : islands[nextIslandIdx % islands.length];
    nextIslandIdx += 1;
    if (!island) break;

    const bucket = byIsland.get(island);
    if (!bucket || bucket.length === 0) {
      // This island is exhausted — drop it from rotation to avoid infinite loops.
      const drop = islands.indexOf(island);
      if (drop !== -1) islands.splice(drop, 1);
      if (islands.length === 0) break;
      continue;
    }

    bucket.sort(
      (a, b) => ucb1Score(b, totalSurfaces, options) - ucb1Score(a, totalSurfaces, options),
    );
    const winner = bucket.shift()!;
    picks.push(winner.item);
  }

  return picks;
}
