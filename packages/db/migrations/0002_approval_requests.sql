-- Migration 0002 — approval_requests table + new task_type enum values
--
-- Two concerns bundled because both are additive and deploy together:
--
-- 1. approval_requests table backs the hard-signoff gate shipped in #32.
--    Preview mode uses the in-memory ApprovalStore; Postgres mode needs
--    this table for approvals to survive a service restart.
--
-- 2. task_type enum gained four values as new review modes shipped
--    (#33 court-ai-disclosure, #34 missing-authority-scan + pipeda-check,
--    #40 contract-redline). ALTER TYPE ADD VALUE is idempotent with
--    IF NOT EXISTS; safe to re-run.
--
-- Reverse migration: dropping enum values is not supported without
-- rewriting rows. If rolled back, any matter whose task_type is one of
-- the new values would need to be mapped back to "om-review" manually
-- before the enum can be dropped.

CREATE TYPE "public"."approval_status" AS ENUM('requested', 'approved', 'rejected', 'withdrawn');

CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "matter_id" uuid NOT NULL,
  "output_hash" text NOT NULL,
  "summary" text NOT NULL,
  "requested_by" text NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" "approval_status" DEFAULT 'requested' NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "rationale" text
);

ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_matter_id_fk"
  FOREIGN KEY ("matter_id") REFERENCES "matters"("id") ON DELETE cascade;

CREATE INDEX IF NOT EXISTS "approval_requests_matter_idx"
  ON "approval_requests" ("matter_id");
CREATE INDEX IF NOT EXISTS "approval_requests_org_pending_idx"
  ON "approval_requests" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "approval_requests_hash_idx"
  ON "approval_requests" ("matter_id", "output_hash", "status");

-- task_type enum: add the review-mode values that shipped after 0000.
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'court-ai-disclosure';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'missing-authority-scan';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'pipeda-check';
ALTER TYPE "public"."task_type" ADD VALUE IF NOT EXISTS 'contract-redline';
