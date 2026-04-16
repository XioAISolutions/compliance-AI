-- Row-Level Security policies for compliance-AI.
--
-- Strategy: every tenant-scoped table has an `organization_id` column. We
-- enforce tenant isolation by setting a per-request session variable
-- `app.org_id` and filtering all reads/writes against it.
--
-- Apply after `drizzle-kit push` (schema must exist first).
--
-- To use in code:
--   await db.execute(sql`SET LOCAL app.org_id = ${orgId}`);
--   -- subsequent queries in the same transaction are automatically filtered.
--
-- The `packages/db` `withOrg()` helper does exactly this.

-- organizations: self-scoped
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_isolation ON organizations
  USING (id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (id = current_setting('app.org_id', true)::uuid);

-- users (org_id nullable until onboarding; drop rows visible when null to admins only)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (organization_id IS NULL OR organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id IS NULL OR organization_id = current_setting('app.org_id', true)::uuid);

-- controls
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY controls_tenant_isolation ON controls
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- control_revisions
ALTER TABLE control_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_revisions_tenant_isolation ON control_revisions
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- cognition_items
ALTER TABLE cognition_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cognition_items_tenant_isolation ON cognition_items
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- matters
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
CREATE POLICY matters_tenant_isolation ON matters
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- matter_documents
ALTER TABLE matter_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY matter_documents_tenant_isolation ON matter_documents
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- document_chunks (denormalized organization_id for fast RLS + retrieval)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_chunks_tenant_isolation ON document_chunks
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- audit_log (never deleted, only appended — policy still applies to SELECT/INSERT)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_tenant_isolation ON audit_log
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- evidence_items
ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_items_tenant_isolation ON evidence_items
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- Auth tables (accounts/sessions/verification_tokens) are NOT tenant-scoped:
-- they link users to identity providers and sessions. NextAuth manages access
-- through the user_id foreign key, which points at `users` (which is
-- tenant-scoped). We leave RLS disabled on these to keep auth flows simple.

-- Bypass role for backend workers that span tenants (audit aggregation, etc.)
-- Grant to your service role only; the default app role should NOT have it.
-- Example:
--   CREATE ROLE compliance_service BYPASSRLS;
--   GRANT compliance_service TO compliance_worker;
