CREATE TABLE "scene_hotspots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_settings_id" uuid NOT NULL,
	"name" text NOT NULL,
	"world_position_x" real DEFAULT 0 NOT NULL,
	"world_position_y" real DEFAULT 0 NOT NULL,
	"world_position_z" real DEFAULT 0 NOT NULL,
	"linked_camera_id" text,
	"visible" boolean DEFAULT true NOT NULL,
	"internal_only" boolean DEFAULT false NOT NULL,
	"sequence_index" integer,
	"style_preset" text DEFAULT 'dot' NOT NULL,
	"payload_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_hotspots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scene_hotspots" ADD CONSTRAINT "scene_hotspots_scene_settings_id_scene_settings_id_fk" FOREIGN KEY ("scene_settings_id") REFERENCES "public"."scene_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scene_hotspots_scene_settings_id_idx" ON "scene_hotspots" USING btree ("scene_settings_id");--> statement-breakpoint
CREATE INDEX "scene_hotspots_sequence_index_idx" ON "scene_hotspots" USING btree ("scene_settings_id","sequence_index");--> statement-breakpoint
CREATE POLICY "scene_hotspots_select_project_member" ON "scene_hotspots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
				exists (
					select 1
					from scene_settings ss
					where ss.id = "scene_hotspots"."scene_settings_id"
						and 
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = ss.scene_id
				and om.user_id = (select auth.uid())
		)
	
				)
			);--> statement-breakpoint
CREATE POLICY "scene_hotspots_insert_project_member" ON "scene_hotspots" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				exists (
					select 1
					from scene_settings ss
					where ss.id = "scene_hotspots"."scene_settings_id"
						and 
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = ss.scene_id
				and om.user_id = (select auth.uid())
		)
	
				)
			);--> statement-breakpoint
CREATE POLICY "scene_hotspots_update_project_member" ON "scene_hotspots" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
				exists (
					select 1
					from scene_settings ss
					where ss.id = "scene_hotspots"."scene_settings_id"
						and 
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = ss.scene_id
				and om.user_id = (select auth.uid())
		)
	
				)
			) WITH CHECK (
				exists (
					select 1
					from scene_settings ss
					where ss.id = "scene_hotspots"."scene_settings_id"
						and 
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = ss.scene_id
				and om.user_id = (select auth.uid())
		)
	
				)
			);--> statement-breakpoint
CREATE POLICY "scene_hotspots_delete_project_admin" ON "scene_hotspots" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
				exists (
					select 1
					from scene_settings ss
					where ss.id = "scene_hotspots"."scene_settings_id"
						and 
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = ss.scene_id
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	
				)
			);