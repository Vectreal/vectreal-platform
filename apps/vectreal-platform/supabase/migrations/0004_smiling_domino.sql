ALTER TABLE "api_keys" ADD COLUMN "organization_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "key_preview" text NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_organization_id_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
DROP POLICY "api_keys_select_self" ON "api_keys" CASCADE;--> statement-breakpoint
DROP POLICY "api_keys_insert_self" ON "api_keys" CASCADE;--> statement-breakpoint
DROP POLICY "api_keys_update_self" ON "api_keys" CASCADE;--> statement-breakpoint
DROP POLICY "api_keys_delete_self" ON "api_keys" CASCADE;--> statement-breakpoint
DROP POLICY "api_key_projects_select_owner_and_project_member" ON "api_key_projects" CASCADE;--> statement-breakpoint
DROP POLICY "api_key_projects_insert_owner_and_project_member" ON "api_key_projects" CASCADE;--> statement-breakpoint
DROP POLICY "api_key_projects_delete_owner" ON "api_key_projects" CASCADE;--> statement-breakpoint
CREATE POLICY "api_keys_select_org_admin" ON "api_keys" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = "api_keys"."organization_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "api_keys_insert_org_admin" ON "api_keys" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = "api_keys"."organization_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "api_keys_update_org_admin" ON "api_keys" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = "api_keys"."organization_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	) WITH CHECK (
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = "api_keys"."organization_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "api_keys_delete_org_admin" ON "api_keys" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = "api_keys"."organization_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "api_key_projects_select_org_admin_and_project_member" ON "api_key_projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
				
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "api_key_projects"."project_id"
				and om.user_id = (select auth.uid())
		)
	
				and exists (
					select 1
					from api_keys ak
					where ak.id = "api_key_projects"."api_key_id"
						and 
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = ak.organization_id
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	
				)
			);--> statement-breakpoint
CREATE POLICY "api_key_projects_insert_org_admin_and_project_member" ON "api_key_projects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "api_key_projects"."project_id"
				and om.user_id = (select auth.uid())
		)
	
				and exists (
					select 1
					from api_keys ak
					where ak.id = "api_key_projects"."api_key_id"
						and 
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = ak.organization_id
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	
				)
			);--> statement-breakpoint
CREATE POLICY "api_key_projects_delete_org_admin" ON "api_key_projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
				exists (
					select 1
					from api_keys ak
					where ak.id = "api_key_projects"."api_key_id"
						and 
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = ak.organization_id
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	
				)
			);