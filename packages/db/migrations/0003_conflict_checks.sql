-- Migration 0003 — conflict_checks table for pre-matter conflict screening
--
-- Backs the LSO-mandated conflict-of-interest check that gates matter
-- creation. The matter-creation route now requires a cleared
-- conflict_check row (or an explicit operator override) before allowing
-- the new matter to land.
--
-- Status machine:
--   pending  → search ran, no decision yet
--   cleared  → partner reviewed hits and cleared (or no hits at all)
--   declined → firm declined the engagement (legitimate conflict)
--
-- Reverse migration: dropping the enum values is not supported without
-- rewriting rows. If rolled back, any check whose decision is one of
-- the new values would need to be remapped before the enum can be
-- dropped.

CREATE TYPE "public"."conflict_decision" AS ENUM('pending', 'cleared', 'declined');

CREATE TABLE IF NOT EXISTS "conflict_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "client_name" text NOT NULL,
  "opposing_party" text,
  "scope" text,
  "hit_matter_ids" text NOT NULL,
  "decision" "conflict_decision" DEFAULT 'pending' NOT NULL,
  "searched_by" text NOT NULL,
  "searched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_by" text,
  "decided_at" timestamp with time zone,
  "rationale" text
);

ALTER TABLE "conflict_checks" ADD CONSTRAINT "conflict_checks_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;

CREATE INDEX IF NOT EXISTS "conflict_checks_org_idx"
  ON "conflict_checks" ("organization_id", "searched_at");
CREATE INDEX IF NOT EXISTS "conflict_checks_decision_idx"
  ON "conflict_checks" ("organization_id", "decision");
