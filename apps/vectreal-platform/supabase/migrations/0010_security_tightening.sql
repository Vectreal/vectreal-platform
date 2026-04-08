-- Comprehensive security tightening:
-- 1) Enforce RLS on previously unrestricted tables
-- 2) Add least-privilege policies for org-scoped billing tables
-- 3) Prevent new plaintext contact PII writes

-- ---------------------------------------------------------------------------
-- RLS enablement + force
-- ---------------------------------------------------------------------------
ALTER TABLE "org_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_subscriptions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "org_limit_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_limit_overrides" FORCE ROW LEVEL SECURITY;

ALTER TABLE "org_entitlement_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_entitlement_overrides" FORCE ROW LEVEL SECURITY;

ALTER TABLE "org_usage_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_usage_counters" FORCE ROW LEVEL SECURITY;

ALTER TABLE "billing_webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_webhook_events" FORCE ROW LEVEL SECURITY;

ALTER TABLE "contact_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_submissions" FORCE ROW LEVEL SECURITY;

ALTER TABLE "scene_action_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scene_action_requests" FORCE ROW LEVEL SECURITY;

ALTER TABLE "scene_action_locks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scene_action_locks" FORCE ROW LEVEL SECURITY;

ALTER TABLE "scene_runtime_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scene_runtime_limits" FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Org-scoped billing policies (authenticated members read, org admins write)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_subscriptions_select_org_member" ON "org_subscriptions";
DROP POLICY IF EXISTS "org_subscriptions_insert_org_admin" ON "org_subscriptions";
DROP POLICY IF EXISTS "org_subscriptions_update_org_admin" ON "org_subscriptions";
DROP POLICY IF EXISTS "org_subscriptions_delete_org_admin" ON "org_subscriptions";

CREATE POLICY "org_subscriptions_select_org_member" ON "org_subscriptions"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "org_subscriptions_insert_org_admin" ON "org_subscriptions"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_subscriptions_update_org_admin" ON "org_subscriptions"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_subscriptions_delete_org_admin" ON "org_subscriptions"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "org_limit_overrides_select_org_member" ON "org_limit_overrides";
DROP POLICY IF EXISTS "org_limit_overrides_insert_org_admin" ON "org_limit_overrides";
DROP POLICY IF EXISTS "org_limit_overrides_update_org_admin" ON "org_limit_overrides";
DROP POLICY IF EXISTS "org_limit_overrides_delete_org_admin" ON "org_limit_overrides";

CREATE POLICY "org_limit_overrides_select_org_member" ON "org_limit_overrides"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "org_limit_overrides_insert_org_admin" ON "org_limit_overrides"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_limit_overrides_update_org_admin" ON "org_limit_overrides"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_limit_overrides_delete_org_admin" ON "org_limit_overrides"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "org_entitlement_overrides_select_org_member" ON "org_entitlement_overrides";
DROP POLICY IF EXISTS "org_entitlement_overrides_insert_org_admin" ON "org_entitlement_overrides";
DROP POLICY IF EXISTS "org_entitlement_overrides_update_org_admin" ON "org_entitlement_overrides";
DROP POLICY IF EXISTS "org_entitlement_overrides_delete_org_admin" ON "org_entitlement_overrides";

CREATE POLICY "org_entitlement_overrides_select_org_member" ON "org_entitlement_overrides"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "org_entitlement_overrides_insert_org_admin" ON "org_entitlement_overrides"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_entitlement_overrides_update_org_admin" ON "org_entitlement_overrides"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_entitlement_overrides_delete_org_admin" ON "org_entitlement_overrides"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "org_usage_counters_select_org_member" ON "org_usage_counters";
DROP POLICY IF EXISTS "org_usage_counters_insert_org_admin" ON "org_usage_counters";
DROP POLICY IF EXISTS "org_usage_counters_update_org_admin" ON "org_usage_counters";
DROP POLICY IF EXISTS "org_usage_counters_delete_org_admin" ON "org_usage_counters";

CREATE POLICY "org_usage_counters_select_org_member" ON "org_usage_counters"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "org_usage_counters_insert_org_admin" ON "org_usage_counters"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_usage_counters_update_org_admin" ON "org_usage_counters"
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_usage_counters_delete_org_admin" ON "org_usage_counters"
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organization_memberships om
      WHERE om.organization_id = organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Defense-in-depth revocations for internal-only tables
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE "billing_webhook_events" FROM anon, authenticated;
REVOKE ALL ON TABLE "contact_submissions" FROM anon, authenticated;
REVOKE ALL ON TABLE "scene_action_requests" FROM anon, authenticated;
REVOKE ALL ON TABLE "scene_action_locks" FROM anon, authenticated;
REVOKE ALL ON TABLE "scene_runtime_limits" FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Encrypted contact storage guardrails (allows legacy rows to remain untouched)
-- ---------------------------------------------------------------------------
ALTER TABLE "contact_submissions"
  DROP CONSTRAINT IF EXISTS "contact_submissions_name_encrypted_chk";
ALTER TABLE "contact_submissions"
  DROP CONSTRAINT IF EXISTS "contact_submissions_email_encrypted_chk";
ALTER TABLE "contact_submissions"
  DROP CONSTRAINT IF EXISTS "contact_submissions_message_encrypted_chk";

ALTER TABLE "contact_submissions"
  ADD CONSTRAINT "contact_submissions_name_encrypted_chk"
  CHECK ("name" LIKE 'enc:v1:%') NOT VALID;

ALTER TABLE "contact_submissions"
  ADD CONSTRAINT "contact_submissions_email_encrypted_chk"
  CHECK ("email" LIKE 'enc:v1:%') NOT VALID;

ALTER TABLE "contact_submissions"
  ADD CONSTRAINT "contact_submissions_message_encrypted_chk"
  CHECK ("message" LIKE 'enc:v1:%') NOT VALID;
