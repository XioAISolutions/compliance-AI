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

-- organizations: self-scoped
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_isolation ON organizations
  USING (id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (id = current_setting('app.org_id', true)::uuid);

-- users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- controls
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY controls_tenant_isolation ON controls
  USING (organization_id = current_setting('app.org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.org_id', true)::uuid);

-- Bypass role for backend workers that span tenants (audit log aggregation, etc.)
-- Grant to your service role only; the default app role should NOT have it.
-- Example:
--   CREATE ROLE compliance_service BYPASSRLS;
--   GRANT compliance_service TO compliance_worker;
