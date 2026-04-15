export type { CognitionItem, CognitionStore, RetrievalQuery, RetrievalResult } from "./types.js";
export { InMemoryCognitionStore } from "./in-memory.js";

import { InMemoryCognitionStore } from "./in-memory.js";
import type { CognitionStore } from "./types.js";

/**
 * Returns a process-wide singleton store. The default backend is in-memory;
 * production code should construct a Postgres-backed store explicitly via
 * `packages/db` (Day 3+) and pass it where needed instead of using this.
 */
let _default: CognitionStore | null = null;
export function getDefaultCognitionStore(): CognitionStore {
  if (!_default) _default = new InMemoryCognitionStore();
  return _default;
}

export function setDefaultCognitionStore(store: CognitionStore): void {
  _default = store;
}
