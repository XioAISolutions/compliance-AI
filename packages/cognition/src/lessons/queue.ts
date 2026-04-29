/**
 * Persistent wake queue.
 *
 * Garden wakes are buffered to a JSON file so a restart doesn't lose
 * pending consolidation work. The format is line-delimited JSON
 * (NDJSON-ish, one envelope per line) — append-only writes, full
 * rewrite on dequeue. Small file, small queue; if a tenant ever
 * pushes this past a few thousand entries we'll move to SQLite.
 *
 * The queue itself is dumb. The scheduler is what decides when to
 * pop and what to do with each envelope.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export type WakeTrigger =
  | "session-close"
  | "crash-recovery"
  | "corpus-commit"
  | "timer";

export interface WakeEnvelope {
  id: string;
  trigger: WakeTrigger;
  organizationId: string;
  /** Free-form payload — e.g., commit SHA for corpus-commit triggers. */
  payload?: Record<string, string>;
  enqueuedAt: string;
}

export interface WakeQueue {
  enqueue(env: Omit<WakeEnvelope, "id" | "enqueuedAt">): WakeEnvelope;
  pending(): WakeEnvelope[];
  dequeue(id: string): WakeEnvelope | null;
  clear(): void;
}

export class FileBackedWakeQueue implements WakeQueue {
  private items: WakeEnvelope[] = [];

  constructor(private readonly path: string) {
    this.load();
  }

  enqueue(env: Omit<WakeEnvelope, "id" | "enqueuedAt">): WakeEnvelope {
    const full: WakeEnvelope = {
      ...env,
      id: randomUUID(),
      enqueuedAt: new Date().toISOString(),
    };
    this.items.push(full);
    this.persist();
    return full;
  }

  pending(): WakeEnvelope[] {
    return [...this.items];
  }

  dequeue(id: string): WakeEnvelope | null {
    const idx = this.items.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const [removed] = this.items.splice(idx, 1);
    this.persist();
    return removed ?? null;
  }

  clear(): void {
    this.items = [];
    this.persist();
  }

  private load(): void {
    if (!existsSync(this.path)) return;
    try {
      const raw = readFileSync(this.path, "utf8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      this.items = lines.map((l) => JSON.parse(l) as WakeEnvelope);
    } catch {
      // Corrupt queue file — start fresh rather than crash. The audit
      // log keeps the original triggers; an operator can re-enqueue
      // anything still relevant.
      this.items = [];
    }
  }

  private persist(): void {
    const dir = dirname(this.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const body = this.items.map((e) => JSON.stringify(e)).join("\n");
    writeFileSync(this.path, body, "utf8");
  }
}

/**
 * In-memory queue for tests — same interface, no disk I/O.
 */
export class InMemoryWakeQueue implements WakeQueue {
  private items: WakeEnvelope[] = [];
  enqueue(env: Omit<WakeEnvelope, "id" | "enqueuedAt">): WakeEnvelope {
    const full: WakeEnvelope = {
      ...env,
      id: randomUUID(),
      enqueuedAt: new Date().toISOString(),
    };
    this.items.push(full);
    return full;
  }
  pending(): WakeEnvelope[] {
    return [...this.items];
  }
  dequeue(id: string): WakeEnvelope | null {
    const idx = this.items.findIndex((e) => e.id === id);
    if (idx < 0) return null;
    const [removed] = this.items.splice(idx, 1);
    return removed ?? null;
  }
  clear(): void {
    this.items = [];
  }
}
