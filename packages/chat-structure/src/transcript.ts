/**
 * JSONL transcript — turn-by-turn persisted conversation log, per matter.
 *
 * Cannibalized from [bcurts/agentchattr](https://github.com/bcurts/agentchattr)
 * `store.py` — JSONL per-session persistence with observer callbacks.
 *
 * Sits alongside the existing hash-chained `audit-log` (apps/web/src/lib/audit-store.ts):
 *   - audit-log    → tamper-evident chain of coarse events (query, retrieval, generation, verdict)
 *   - transcript   → turn-by-turn replayable record with full prose + tool calls
 *
 * They don't duplicate: a single audit-log row may span multiple transcript
 * turns (e.g. one "generation" audit row covers all drafter + judge turns of
 * a loop). The transcript is what the UI timeline renders; the audit-log is
 * what the regulator-facing export surfaces.
 *
 * Backend is in-memory for now. DB-backed (Day 3+) swap-in requires only
 * replacing the `TranscriptStore` interface implementation — the SSE
 * coordinator and UI don't change.
 */

import { randomUUID } from "node:crypto";
import type { TranscriptTurn } from "./types.js";

export interface AppendInput extends Omit<TranscriptTurn, "id" | "seq" | "createdAt"> {
  id?: string;
}

export interface TranscriptStore {
  append(turn: AppendInput): TranscriptTurn;
  getByMatter(matterId: string): TranscriptTurn[];
  /** Produce the raw JSONL representation for export / replay. */
  toJsonl(matterId: string): string;
  /** Drop every turn for a matter (test helper). */
  clear(matterId?: string): void;
}

/**
 * Process-wide in-memory store. Keeps a separate seq counter per matter so
 * ordering is stable + replayable across matters.
 */
export class InMemoryTranscriptStore implements TranscriptStore {
  private turns: TranscriptTurn[] = [];
  private seqByMatter = new Map<string, number>();

  append(input: AppendInput): TranscriptTurn {
    const seq = (this.seqByMatter.get(input.matterId) ?? 0) + 1;
    this.seqByMatter.set(input.matterId, seq);
    const turn: TranscriptTurn = {
      ...input,
      id: input.id ?? randomUUID(),
      seq,
      createdAt: new Date().toISOString(),
    };
    this.turns.push(turn);
    return turn;
  }

  getByMatter(matterId: string): TranscriptTurn[] {
    return this.turns
      .filter((t) => t.matterId === matterId)
      .sort((a, b) => a.seq - b.seq);
  }

  toJsonl(matterId: string): string {
    return this.getByMatter(matterId)
      .map((t) => JSON.stringify(t))
      .join("\n");
  }

  clear(matterId?: string): void {
    if (matterId) {
      this.turns = this.turns.filter((t) => t.matterId !== matterId);
      this.seqByMatter.delete(matterId);
    } else {
      this.turns = [];
      this.seqByMatter.clear();
    }
  }
}

let _default: TranscriptStore | null = null;

export function getDefaultTranscriptStore(): TranscriptStore {
  if (!_default) _default = new InMemoryTranscriptStore();
  return _default;
}

export function setDefaultTranscriptStore(store: TranscriptStore): void {
  _default = store;
}

export function toJsonl<T>(records: T[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n");
}
