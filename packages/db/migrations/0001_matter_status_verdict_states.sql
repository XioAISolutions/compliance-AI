-- Migration 0001 — extend matter_status with verdict-driven states
--
-- Before this change, every review that didn't hit READY_TO_SUBMIT left
-- the matter at 'in-review' permanently. That made the matters list
-- unreadable — open / in-review looked like "pending" + "also pending",
-- with no fast way to see "this one needs my attention" vs "this one
-- died mid-stream".
--
-- New state machine (see apps/web/src/lib/matter-store.ts for the full
-- chart):
--   ITERATE after maxRounds → 'needs-revision'  (soft stop)
--   REWRITE after maxRounds → 'blocked'         (hard stop)
--   Review error mid-stream → 'blocked'
--
-- Safe to apply without downtime: adding enum values never invalidates
-- existing rows. The reverse (removing a value) would require rewriting
-- any row that held it — don't downgrade without a companion migration
-- that maps these states onto the remaining ones.

ALTER TYPE "public"."matter_status" ADD VALUE IF NOT EXISTS 'needs-revision';
ALTER TYPE "public"."matter_status" ADD VALUE IF NOT EXISTS 'blocked';
