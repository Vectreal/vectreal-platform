DROP POLICY "permissions_select_recipient_or_granter" ON "permissions" CASCADE;--> statement-breakpoint
DROP POLICY "permissions_insert_self_or_group_owner" ON "permissions" CASCADE;--> statement-breakpoint
DROP POLICY "permissions_update_granter_or_group_owner" ON "permissions" CASCADE;--> statement-breakpoint
DROP POLICY "permissions_delete_granter_or_group_owner" ON "permissions" CASCADE;--> statement-breakpoint
DROP TABLE "permissions" CASCADE;--> statement-breakpoint
DROP POLICY "tags_select_authenticated" ON "tags" CASCADE;--> statement-breakpoint
DROP POLICY "tags_insert_authenticated" ON "tags" CASCADE;--> statement-breakpoint
DROP POLICY "tags_update_authenticated" ON "tags" CASCADE;--> statement-breakpoint
DROP POLICY "tags_delete_authenticated" ON "tags" CASCADE;--> statement-breakpoint
DROP TABLE "tags" CASCADE;--> statement-breakpoint
DROP POLICY "tag_assignments_select_target_member" ON "tag_assignments" CASCADE;--> statement-breakpoint
DROP POLICY "tag_assignments_insert_target_member" ON "tag_assignments" CASCADE;--> statement-breakpoint
DROP POLICY "tag_assignments_delete_target_member" ON "tag_assignments" CASCADE;--> statement-breakpoint
DROP TABLE "tag_assignments" CASCADE;--> statement-breakpoint
DROP TYPE "public"."permission_entity";--> statement-breakpoint
DROP TYPE "public"."permission_type";