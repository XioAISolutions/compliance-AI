CREATE TYPE "public"."control_status" AS ENUM('not-started', 'in-progress', 'evidence-collected', 'reviewed', 'approved', 'exception');--> statement-breakpoint
CREATE TYPE "public"."framework" AS ENUM('soc2', 'gdpr', 'eu-ai-act', 'iso-27001');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."judge_verdict" AS ENUM('READY_TO_SUBMIT', 'ITERATE', 'REWRITE');--> statement-breakpoint
CREATE TYPE "public"."persona_id" AS ENUM('drafter', 'reviewer', 'evidence-collector', 'risk-assessor', 'judge', 'om-reviewer');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('authority-rule', 'regulatory-guidance', 'offering-memo', 'kyc-aml-file', 'marketing-material', 'reference-material', 'other');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction" AS ENUM('ontario', 'quebec', 'british-columbia', 'alberta', 'federal');--> statement-breakpoint
CREATE TYPE "public"."matter_status" AS ENUM('open', 'in-review', 'complete', 'archived');--> statement-breakpoint
CREATE TYPE "public"."registration_category" AS ENUM('emd', 'pm', 'iiroc', 'issuer', 'none');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('om-review', 'kyc-gap-check', 'marketing-signoff', 'response-memo');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('missing', 'requested', 'stale', 'present', 'approved');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"framework_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" text NOT NULL,
	"name" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"framework" "framework" NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "control_status" DEFAULT 'not-started' NOT NULL,
	"owner_id" uuid,
	"framework_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "controls_org_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "control_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"parent_id" uuid,
	"motivation" text NOT NULL,
	"persona" "persona_id" NOT NULL,
	"content" text NOT NULL,
	"verdict" "judge_verdict",
	"retrieved_cognition_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage" jsonb DEFAULT '{"inputTokens":0,"outputTokens":0,"cacheReadTokens":0}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cognition_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"framework" "framework",
	"control_slug" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matter_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matter_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"document_type" "document_type" DEFAULT 'other' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"sha256" text NOT NULL,
	"page_count" integer,
	"source_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"jurisdiction" "jurisdiction" NOT NULL,
	"registration_category" "registration_category" NOT NULL,
	"task_type" "task_type" NOT NULL,
	"status" "matter_status" DEFAULT 'open' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"matter_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"input_hash" text NOT NULL,
	"authorities_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_hash" text,
	"judge_verdict" text,
	"prev_row_hash" text,
	"input_content" text,
	"output_content" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"matter_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"content" text NOT NULL,
	"char_start" integer NOT NULL,
	"char_end" integer NOT NULL,
	"page" integer,
	"token_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidence_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"matter_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"source" text,
	"status" "evidence_status" DEFAULT 'missing' NOT NULL,
	"requested_from" text,
	"file_uri" text,
	"sha256" text,
	"collected_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "controls" ADD CONSTRAINT "controls_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "controls" ADD CONSTRAINT "controls_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "control_revisions" ADD CONSTRAINT "control_revisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "control_revisions" ADD CONSTRAINT "control_revisions_control_id_controls_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."controls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "control_revisions" ADD CONSTRAINT "control_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cognition_items" ADD CONSTRAINT "cognition_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matter_documents" ADD CONSTRAINT "matter_documents_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matter_documents" ADD CONSTRAINT "matter_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matters" ADD CONSTRAINT "matters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "matters" ADD CONSTRAINT "matters_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_matter_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."matter_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_matter_id_matters_id_fk" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidence_items" ADD CONSTRAINT "evidence_items_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_org_email_idx" ON "users" USING btree ("organization_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "controls_org_framework_idx" ON "controls" USING btree ("organization_id","framework");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "controls_org_status_idx" ON "controls" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "control_revisions_control_idx" ON "control_revisions" USING btree ("control_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "control_revisions_parent_idx" ON "control_revisions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "control_revisions_org_idx" ON "control_revisions" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cognition_items_org_framework_idx" ON "cognition_items" USING btree ("organization_id","framework");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cognition_items_org_control_idx" ON "cognition_items" USING btree ("organization_id","control_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matter_documents_matter_idx" ON "matter_documents" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matter_documents_org_idx" ON "matter_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matters_org_idx" ON "matters" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matters_status_idx" ON "matters" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_matter_idx" ON "audit_log" USING btree ("matter_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_org_idx" ON "audit_log" USING btree ("organization_id","timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_chunks_doc_ordinal_idx" ON "document_chunks" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_chunks_matter_idx" ON "document_chunks" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_chunks_org_idx" ON "document_chunks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_items_matter_idx" ON "evidence_items" USING btree ("matter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_items_org_idx" ON "evidence_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_items_status_idx" ON "evidence_items" USING btree ("matter_id","status");