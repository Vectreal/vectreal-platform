DROP POLICY "org_usage_counters_select_org_member" ON "org_usage_counters" CASCADE;--> statement-breakpoint
DROP POLICY "org_usage_counters_insert_org_admin" ON "org_usage_counters" CASCADE;--> statement-breakpoint
DROP POLICY "org_usage_counters_update_org_admin" ON "org_usage_counters" CASCADE;--> statement-breakpoint
DROP POLICY "org_usage_counters_delete_org_admin" ON "org_usage_counters" CASCADE;--> statement-breakpoint
DROP TABLE "org_usage_counters" CASCADE;