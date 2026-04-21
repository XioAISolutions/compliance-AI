/**
 * Output snapshot store — one row per completed review run, so a
 * lawyer can compare round N+1 against round N without losing the
 * prior output.
 *
 * Today every new review wipes the matter page's `output` state. The
 * snapshot store captures the final prose + citations right after the
 * citations SSE frame lands, so a later compare call can produce a
 * redline between any two rounds.
 *
 * In-memory store only in this PR; Postgres backend is a natural
 * follow-up once the feature has seen real use and we know the index
 * shape we need.
 */

import { randomUUID } from "node:crypto";

export interface OutputSnapshot {
  id: string;
  matterId: string;
  versionNo: number;
  content: string;
  /** Opaque — whatever citation shape the review emitted. Stored so a
   * future re-export can regenerate the DOCX without re-running the
   * model. Not serialized into the diff; the diff operates on
   * `content`. */
  citations: unknown[];
  createdAt: Date;
  createdBy: string;
}

export interface CreateOutputSnapshotInput {
  matterId: string;
  content: string;
  citations?: unknown[];
  createdBy?: string;
}

export interface OutputSnapshotStore {
  append(input: CreateOutputSnapshotInput): Promise<OutputSnapshot>;
  list(matterId: string): Promise<OutputSnapshot[]>;
  get(matterId: string, versionNo: number): Promise<OutputSnapshot | null>;
  latest(matterId: string): Promise<OutputSnapshot | null>;
  size(matterId?: string): Promise<number>;
}

export class InMemoryOutputSnapshotStore implements OutputSnapshotStore {
  private byMatter = new Map<string, OutputSnapshot[]>();

  async append(input: CreateOutputSnapshotInput): Promise<OutputSnapshot> {
    const list = this.byMatter.get(input.matterId) ?? [];
    const snap: OutputSnapshot = {
      id: randomUUID(),
      matterId: input.matterId,
      versionNo: list.length + 1,
      content: input.content,
      citations: input.citations ?? [],
      createdAt: new Date(),
      createdBy: input.createdBy ?? "reviewer",
    };
    list.push(snap);
    this.byMatter.set(input.matterId, list);
    return snap;
  }

  async list(matterId: string): Promise<OutputSnapshot[]> {
    return [...(this.byMatter.get(matterId) ?? [])];
  }

  async get(matterId: string, versionNo: number): Promise<OutputSnapshot | null> {
    const list = this.byMatter.get(matterId) ?? [];
    return list.find((s) => s.versionNo === versionNo) ?? null;
  }

  async latest(matterId: string): Promise<OutputSnapshot | null> {
    const list = this.byMatter.get(matterId) ?? [];
    return list.length > 0 ? list[list.length - 1]! : null;
  }

  async size(matterId?: string): Promise<number> {
    if (matterId) return (this.byMatter.get(matterId) ?? []).length;
    let n = 0;
    for (const list of this.byMatter.values()) n += list.length;
    return n;
  }
}

let _default: OutputSnapshotStore | null = null;
let _override: OutputSnapshotStore | null = null;

/**
 * Singleton factory. Postgres backend is a follow-up; preview and
 * tests use the in-memory store. The review route calls `append`
 * from its SSE finalizer so the snapshot is ready by the time the
 * client asks for /outputs.
 */
export function getDefaultOutputSnapshotStore(): OutputSnapshotStore {
  if (_override) return _override;
  if (_default) return _default;
  _default = new InMemoryOutputSnapshotStore();
  return _default;
}

export function setOutputSnapshotStore(store: OutputSnapshotStore | null): void {
  _override = store;
  if (store === null) _default = null;
}
