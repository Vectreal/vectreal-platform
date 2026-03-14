-- Migration: Backfill existing organisations with safe default billing state
-- Issue #269: Backfill and migration for existing users/organizations
--
-- For every organisation that does not yet have a row in org_subscriptions,
-- insert a default row with plan = 'free' and billing_state = 'none'.
-- This leaves existing users in a fully functional, non-blocking state.
--
-- Dry-run query (run before applying to verify scope):
--   SELECT count(*) FROM organizations o
--   WHERE NOT EXISTS (
--     SELECT 1 FROM org_subscriptions s WHERE s.organization_id = o.id
--   );
--
-- Rollback strategy:
--   DELETE FROM org_subscriptions
--   WHERE created_at >= '<migration_timestamp>'
--     AND billing_state = 'none'
--     AND plan = 'free';

INSERT INTO org_subscriptions (organization_id, plan, billing_state, created_at, updated_at)
SELECT
  o.id,
  'free',
  'none',
  now(),
  now()
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1
  FROM org_subscriptions s
  WHERE s.organization_id = o.id
)
ON CONFLICT (organization_id) DO NOTHING;
