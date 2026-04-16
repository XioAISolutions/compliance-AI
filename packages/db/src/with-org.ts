/**
 * withOrg — multi-tenant session scope.
 *
 * Opens a transaction, sets the Postgres session variable `app.org_id` so
 * RLS policies can filter, runs the callback inside it, then rolls back or
 * commits normally. Every tenant-scoped query should go through here.
 *
 * Usage:
 *
 *   await withOrg(orgId, async (tx) => {
 *     const rows = await tx.select().from(matters);
 *     return rows;
 *   });
 *
 * If RLS is not enabled on a table yet (early migrations), this still works —
 * the SET LOCAL is harmless when no policy references it.
 */

import { sql } from "drizzle-orm";
import { getDb } from "./client.js";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The organization id goes into a SET LOCAL statement as literal SQL, so we
 * reject anything that isn't a UUID-shaped token. This is a defense-in-depth
 * measure — callers should never build org ids from user input, but if they
 * do, this prevents SQL injection via the SET LOCAL path.
 */
const ORG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^preview$|^[a-z][a-z0-9-]{1,62}$/i;

export function isValidOrgId(organizationId: string): boolean {
  return ORG_ID_RE.test(organizationId);
}

export async function withOrg<T>(
  organizationId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!isValidOrgId(organizationId)) {
    throw new Error(`Invalid organizationId: ${organizationId}`);
  }
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL app.org_id = '${organizationId}'`));
    return fn(tx);
  });
}

/**
 * For code paths that haven't adopted withOrg yet — returns the raw db
 * client without a transaction or scope. New code should always use withOrg.
 */
export function unscopedDb() {
  return getDb();
}
