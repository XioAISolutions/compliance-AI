/**
 * Metrics collector for the lesson layer.
 *
 * Plain values, no histograms — intentionally boring so the metrics
 * endpoint can serialize as JSON and the audit log stays readable.
 *
 * Counters:
 *   - reinforced / inserted / superseded — sidecar action ratios
 *   - dedupRemoved                       — lessons removed by garden
 *   - gardenCycles                       — number of completed cycles
 *
 * Spend tracking:
 *   - ambientTokensByDay  — keyed by ISO date (YYYY-MM-DD), UTC.
 *
 * Latency:
 *   - sidecarSamples / sidecarTotalMs   — running mean
 *   - gardenSamples / gardenTotalMs     — running mean
 *   - sidecarSlowCount                  — count of >budget calls
 */

export interface SidecarSample {
  action: "inserted" | "reinforced" | "superseded";
  durationMs: number;
}

export interface MetricsRecorder {
  recordSidecar(sample: SidecarSample): void;
  recordSidecarSlow(durationMs: number): void;
  recordGardenCycle(durationMs: number, dedupRemoved: number): void;
  recordAmbientTokens(provider: string, count: number): void;
}

export interface MetricsSnapshot {
  reinforcedCount: number;
  insertedCount: number;
  supersededCount: number;
  /** reinforced / (reinforced + inserted) — 0 when no writes yet. */
  reinforceRatio: number;
  dedupRemoved: number;
  gardenCycles: number;
  ambientTokensByDay: Record<string, number>;
  ambientTokensByProvider: Record<string, number>;
  averageSidecarMs: number;
  sidecarSlowCount: number;
  averageGardenMs: number;
  /**
   * Simple "time saved" estimator: (reinforced * estInsertCostMs) -
   * (reinforced * estReinforceCostMs). Coarse, but enough to show the
   * sidecar is paying its way.
   */
  estimatedTurnTimeSavedMs: number;
}

const EST_INSERT_MS = 12; // baseline write cost for a fresh lesson
const EST_REINFORCE_MS = 3; // bumping a counter is cheaper than writing prose

export class InMemoryMetrics implements MetricsRecorder {
  private inserted = 0;
  private reinforced = 0;
  private superseded = 0;
  private dedupRemoved = 0;
  private gardenCycles = 0;
  private sidecarSamples = 0;
  private sidecarTotalMs = 0;
  private sidecarSlow = 0;
  private gardenSamples = 0;
  private gardenTotalMs = 0;
  private tokensByDay = new Map<string, number>();
  private tokensByProvider = new Map<string, number>();

  recordSidecar(sample: SidecarSample): void {
    if (sample.action === "inserted") this.inserted++;
    else if (sample.action === "reinforced") this.reinforced++;
    else this.superseded++;
    this.sidecarSamples++;
    this.sidecarTotalMs += sample.durationMs;
  }

  recordSidecarSlow(_durationMs: number): void {
    this.sidecarSlow++;
  }

  recordGardenCycle(durationMs: number, dedupRemoved: number): void {
    this.gardenCycles++;
    this.gardenSamples++;
    this.gardenTotalMs += durationMs;
    this.dedupRemoved += dedupRemoved;
  }

  recordAmbientTokens(provider: string, count: number): void {
    const day = isoDay(new Date());
    this.tokensByDay.set(day, (this.tokensByDay.get(day) ?? 0) + count);
    this.tokensByProvider.set(
      provider,
      (this.tokensByProvider.get(provider) ?? 0) + count,
    );
  }

  snapshot(): MetricsSnapshot {
    const writes = this.inserted + this.reinforced;
    const reinforceRatio = writes === 0 ? 0 : this.reinforced / writes;
    const averageSidecarMs =
      this.sidecarSamples === 0 ? 0 : this.sidecarTotalMs / this.sidecarSamples;
    const averageGardenMs =
      this.gardenSamples === 0 ? 0 : this.gardenTotalMs / this.gardenSamples;
    const estimatedTurnTimeSavedMs =
      this.reinforced * (EST_INSERT_MS - EST_REINFORCE_MS);
    return {
      reinforcedCount: this.reinforced,
      insertedCount: this.inserted,
      supersededCount: this.superseded,
      reinforceRatio,
      dedupRemoved: this.dedupRemoved,
      gardenCycles: this.gardenCycles,
      ambientTokensByDay: Object.fromEntries(this.tokensByDay),
      ambientTokensByProvider: Object.fromEntries(this.tokensByProvider),
      averageSidecarMs,
      sidecarSlowCount: this.sidecarSlow,
      averageGardenMs,
      estimatedTurnTimeSavedMs,
    };
  }
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
