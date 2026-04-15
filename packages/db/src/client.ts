import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Returns a singleton Drizzle client. Callers should set DATABASE_URL before
 * the first call. The client is lazily initialized so package imports stay
 * side-effect-free.
 */
export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const client = postgres(url, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
