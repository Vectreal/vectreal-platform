CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('texture', 'material', 'model', 'environment', 'other');--> statement-breakpoint
CREATE TYPE "public"."scene_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."permission_entity" AS ENUM('user', 'group');--> statement-breakpoint
CREATE TYPE "public"."permission_type" AS ENUM('read', 'write', 'admin', 'delete');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"invited_at" timestamp,
	"invited_by" uuid
);
--> statement-breakpoint
ALTER TABLE "organization_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scene_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"parent_folder_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_folder_id" uuid
);
--> statement-breakpoint
ALTER TABLE "folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"folder_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "asset_type" NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"metadata" json,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"folder_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"status" "scene_status" DEFAULT 'draft' NOT NULL,
	"thumbnail_url" text,
	"thumbnail_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scenes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scene_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"environment" json,
	"controls" json,
	"shadows" json,
	"meta" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "scene_settings_scene_id_unique" UNIQUE("scene_id")
);
--> statement-breakpoint
ALTER TABLE "scene_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scene_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"label" text,
	"description" text,
	"baseline" json,
	"optimized" json,
	"initial_scene_bytes" integer,
	"current_scene_bytes" integer,
	"applied_optimizations" json,
	"optimization_settings" json,
	"additional_metrics" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scene_stats_scene_id_unique" UNIQUE("scene_id")
);
--> statement-breakpoint
ALTER TABLE "scene_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scene_assets" (
	"scene_settings_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"usage_type" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scene_assets_scene_settings_id_asset_id_pk" PRIMARY KEY("scene_settings_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "scene_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scene_published" (
	"scene_id" uuid PRIMARY KEY NOT NULL,
	"asset_id" uuid NOT NULL,
	"scene_settings_id" uuid,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"published_by" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_published" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid NOT NULL,
	"entity_type" "permission_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"permission" "permission_type" NOT NULL,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_memberships_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "group_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tag_assignments" (
	"tag_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	CONSTRAINT "tag_assignments_tag_id_target_type_target_id_pk" PRIMARY KEY("tag_id","target_type","target_id")
);
--> statement-breakpoint
ALTER TABLE "tag_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"hashed_key" text NOT NULL,
	"active" boolean DEFAULT true,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_key_projects" (
	"api_key_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_projects_api_key_id_project_id_pk" PRIMARY KEY("api_key_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "api_key_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD CONSTRAINT "scene_folders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD CONSTRAINT "scene_folders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_folders" ADD CONSTRAINT "scene_folders_parent_folder_id_scene_folders_id_fk" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."scene_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_folder_id_folders_id_fk" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_folder_id_scene_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."scene_folders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_settings" ADD CONSTRAINT "scene_settings_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_settings" ADD CONSTRAINT "scene_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_stats" ADD CONSTRAINT "scene_stats_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_stats" ADD CONSTRAINT "scene_stats_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_scene_settings_id_scene_settings_id_fk" FOREIGN KEY ("scene_settings_id") REFERENCES "public"."scene_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_assets" ADD CONSTRAINT "scene_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_published" ADD CONSTRAINT "scene_published_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_published" ADD CONSTRAINT "scene_published_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_published" ADD CONSTRAINT "scene_published_scene_settings_id_scene_settings_id_fk" FOREIGN KEY ("scene_settings_id") REFERENCES "public"."scene_settings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_published" ADD CONSTRAINT "scene_published_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_assignments" ADD CONSTRAINT "tag_assignments_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_projects" ADD CONSTRAINT "api_key_projects_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key_projects" ADD CONSTRAINT "api_key_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organizations_owner_id_idx" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_invited_by_idx" ON "organization_memberships" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "projects_organization_id_idx" ON "projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scene_folders_project_id_idx" ON "scene_folders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "scene_folders_owner_id_idx" ON "scene_folders" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "scene_folders_parent_folder_id_idx" ON "scene_folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "folders_project_id_idx" ON "folders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "folders_parent_folder_id_idx" ON "folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "assets_folder_id_idx" ON "assets" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "assets_owner_id_idx" ON "assets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "scenes_project_id_idx" ON "scenes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "scenes_folder_id_idx" ON "scenes" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "scene_settings_created_by_idx" ON "scene_settings" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "scene_stats_created_by_idx" ON "scene_stats" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "scene_assets_scene_settings_id_idx" ON "scene_assets" USING btree ("scene_settings_id");--> statement-breakpoint
CREATE INDEX "scene_assets_asset_id_idx" ON "scene_assets" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "scene_published_asset_id_idx" ON "scene_published" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "scene_published_scene_settings_id_idx" ON "scene_published" USING btree ("scene_settings_id");--> statement-breakpoint
CREATE INDEX "scene_published_published_by_idx" ON "scene_published" USING btree ("published_by");--> statement-breakpoint
CREATE INDEX "permissions_granted_by_idx" ON "permissions" USING btree ("granted_by");--> statement-breakpoint
CREATE INDEX "group_memberships_group_id_idx" ON "group_memberships" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_memberships_user_id_idx" ON "group_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "groups_owner_id_idx" ON "groups" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tag_assignments_tag_id_idx" ON "tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_key_projects_api_key_id_idx" ON "api_key_projects" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "api_key_projects_project_id_idx" ON "api_key_projects" USING btree ("project_id");--> statement-breakpoint
CREATE POLICY "users_select_self" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_insert_self" ON "users" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "users_update_self" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("users"."id" = (select auth.uid())) WITH CHECK ("users"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "organizations_select_member" ON "organizations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = "organizations"."id"
						and om.user_id = (select auth.uid())
				)
			);--> statement-breakpoint
CREATE POLICY "organizations_insert_owner" ON "organizations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("organizations"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "organizations_update_owner" ON "organizations" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = "organizations"."id"
						and om.user_id = (select auth.uid())
						and om.role = 'owner'
				)
			) WITH CHECK (
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = "organizations"."id"
						and om.user_id = (select auth.uid())
						and om.role = 'owner'
				)
			);--> statement-breakpoint
CREATE POLICY "organizations_delete_owner" ON "organizations" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = "organizations"."id"
						and om.user_id = (select auth.uid())
						and om.role = 'owner'
				)
			);--> statement-breakpoint
CREATE POLICY "org_memberships_select_org_member" ON "organization_memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = "organization_memberships"."organization_id"
						and om.user_id = (select auth.uid())
				)
			);--> statement-breakpoint
CREATE POLICY "org_memberships_insert_org_admin" ON "organization_memberships" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = "organization_memberships"."organization_id"
						and om.user_id = (select auth.uid())
						and om.role in ('owner', 'admin')
				)
			);--> statement-breakpoint
CREATE POLICY "org_memberships_update_org_admin" ON "organization_memberships" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = "organization_memberships"."organization_id"
						and om.user_id = (select auth.uid())
						and om.role in ('owner', 'admin')
				)
			) WITH CHECK (
				exists (
					select 1
					from organization_memberships om
					where om.organization_id = "organization_memberships"."organization_id"
						and om.user_id = (select auth.uid())
						and om.role in ('owner', 'admin')
				)
			);--> statement-breakpoint
CREATE POLICY "org_memberships_delete_org_admin_or_self" ON "organization_memberships" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
				(
					exists (
						select 1
						from organization_memberships om
						where om.organization_id = "organization_memberships"."organization_id"
							and om.user_id = (select auth.uid())
							and om.role in ('owner', 'admin')
					)
					or "organization_memberships"."user_id" = (select auth.uid())
				)
			);--> statement-breakpoint
CREATE POLICY "projects_select_org_member" ON "projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "projects"."id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "projects_insert_org_admin" ON "projects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
		exists (
			select 1
			from organization_memberships om
			where om.organization_id = "projects"."organization_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "projects_update_org_admin" ON "projects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "projects"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	) WITH CHECK (
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "projects"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "projects_delete_org_admin" ON "projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "projects"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "scene_folders_select_project_member" ON "scene_folders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from scene_folders sf
			join projects p on p.id = sf.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where sf.id = "scene_folders"."id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "scene_folders_insert_project_member_self_owner" ON "scene_folders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "scene_folders"."project_id"
				and om.user_id = (select auth.uid())
		)
	 and "scene_folders"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "scene_folders_update_owner_or_admin" ON "scene_folders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from scene_folders sf
			join projects p on p.id = sf.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where sf.id = "scene_folders"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	 or "scene_folders"."owner_id" = (select auth.uid())) WITH CHECK (
		exists (
			select 1
			from scene_folders sf
			join projects p on p.id = sf.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where sf.id = "scene_folders"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	 or "scene_folders"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "scene_folders_delete_owner_or_admin" ON "scene_folders" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from scene_folders sf
			join projects p on p.id = sf.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where sf.id = "scene_folders"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	 or "scene_folders"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "folders_select_project_member" ON "folders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = "folders"."id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "folders_insert_project_admin" ON "folders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "folders"."project_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "folders_update_project_admin" ON "folders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = "folders"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	) WITH CHECK (
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = "folders"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "folders_delete_project_admin" ON "folders" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = "folders"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "assets_select_project_member" ON "assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = "assets"."id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "assets_insert_project_member_self_owner" ON "assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = "assets"."folder_id"
				and om.user_id = (select auth.uid())
		)
	 and "assets"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "assets_update_project_member_owner" ON "assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = "assets"."id"
				and om.user_id = (select auth.uid())
		)
	) WITH CHECK (
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = "assets"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	 and "assets"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "assets_delete_project_admin" ON "assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = "assets"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "scenes_select_project_member" ON "scenes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scenes"."id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "scenes_insert_project_member" ON "scenes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "scenes"."project_id"
				and om.user_id = (select auth.uid())
		)
	
				and ("scenes"."folder_id" is null or 
		exists (
			select 1
			from scene_folders sf
			join projects p on p.id = sf.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where sf.id = "scenes"."folder_id"
				and om.user_id = (select auth.uid())
		)
	)
			);--> statement-breakpoint
CREATE POLICY "scenes_update_project_member" ON "scenes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scenes"."id"
				and om.user_id = (select auth.uid())
		)
	) WITH CHECK (
				
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scenes"."id"
				and om.user_id = (select auth.uid())
		)
	
				and ("scenes"."folder_id" is null or 
		exists (
			select 1
			from scene_folders sf
			join projects p on p.id = sf.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where sf.id = "scenes"."folder_id"
				and om.user_id = (select auth.uid())
		)
	)
			);--> statement-breakpoint
CREATE POLICY "scenes_delete_project_admin" ON "scenes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scenes"."id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "scene_settings_select_project_member" ON "scene_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_settings"."scene_id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "scene_settings_insert_project_member_self_creator" ON "scene_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_settings"."scene_id"
				and om.user_id = (select auth.uid())
		)
	 and "scene_settings"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "scene_settings_update_project_member" ON "scene_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_settings"."scene_id"
				and om.user_id = (select auth.uid())
		)
	) WITH CHECK (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_settings"."scene_id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "scene_settings_delete_project_admin" ON "scene_settings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_settings"."scene_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "scene_stats_select_project_member" ON "scene_stats" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_stats"."scene_id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "scene_stats_insert_project_member_self_creator" ON "scene_stats" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_stats"."scene_id"
				and om.user_id = (select auth.uid())
		)
	 and "scene_stats"."created_by" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "scene_stats_update_project_member" ON "scene_stats" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_stats"."scene_id"
				and om.user_id = (select auth.uid())
		)
	) WITH CHECK (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_stats"."scene_id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "scene_stats_delete_project_admin" ON "scene_stats" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_stats"."scene_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "scene_assets_select_project_member" ON "scene_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
				exists (
					select 1
					from scene_settings ss
					join scenes s on s.id = ss.scene_id
					join projects p on p.id = s.project_id
					join organization_memberships om on om.organization_id = p.organization_id
					where ss.id = "scene_assets"."scene_settings_id"
						and om.user_id = (select auth.uid())
				)
			);--> statement-breakpoint
CREATE POLICY "scene_assets_insert_project_member" ON "scene_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = "scene_assets"."asset_id"
				and om.user_id = (select auth.uid())
		)
	
				and exists (
					select 1
					from scene_settings ss
					join scenes s on s.id = ss.scene_id
					join projects p on p.id = s.project_id
					join organization_memberships om on om.organization_id = p.organization_id
					where ss.id = "scene_assets"."scene_settings_id"
						and om.user_id = (select auth.uid())
				)
			);--> statement-breakpoint
CREATE POLICY "scene_assets_delete_project_member" ON "scene_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
				exists (
					select 1
					from scene_settings ss
					join scenes s on s.id = ss.scene_id
					join projects p on p.id = s.project_id
					join organization_memberships om on om.organization_id = p.organization_id
					where ss.id = "scene_assets"."scene_settings_id"
						and om.user_id = (select auth.uid())
				)
			);--> statement-breakpoint
CREATE POLICY "scene_published_select_project_member" ON "scene_published" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_published"."scene_id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "scene_published_insert_project_member_self_publisher" ON "scene_published" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_published"."scene_id"
				and om.user_id = (select auth.uid())
		)
	
				and "scene_published"."published_by" = (select auth.uid())
				and exists (
					select 1
					from assets a
					join folders f on f.id = a.folder_id
					join projects p on p.id = f.project_id
					join scenes s on s.project_id = p.id
					join organization_memberships om on om.organization_id = p.organization_id
					where s.id = "scene_published"."scene_id"
						and a.id = "scene_published"."asset_id"
						and om.user_id = (select auth.uid())
				)
			);--> statement-breakpoint
CREATE POLICY "scene_published_update_project_member" ON "scene_published" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_published"."scene_id"
				and om.user_id = (select auth.uid())
		)
	) WITH CHECK (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_published"."scene_id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "scene_published_delete_project_admin" ON "scene_published" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "scene_published"."scene_id"
				and om.user_id = (select auth.uid())
				and om.role in ('owner', 'admin')
		)
	);--> statement-breakpoint
CREATE POLICY "permissions_select_recipient_or_granter" ON "permissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
				"permissions"."granted_by" = (select auth.uid())
				or ("permissions"."entity_type" = 'user' and "permissions"."entity_id" = (select auth.uid()))
				or ("permissions"."entity_type" = 'group' and 
		exists (
			select 1
			from group_memberships gm
			where gm.group_id = "permissions"."entity_id"
				and gm.user_id = (select auth.uid())
		)
	)
			);--> statement-breakpoint
CREATE POLICY "permissions_insert_self_or_group_owner" ON "permissions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				"permissions"."granted_by" = (select auth.uid())
				and (
					("permissions"."entity_type" = 'user' and "permissions"."entity_id" = (select auth.uid()))
					or ("permissions"."entity_type" = 'group' and 
		exists (
			select 1
			from groups g
			where g.id = "permissions"."entity_id"
				and g.owner_id = (select auth.uid())
		)
	)
				)
			);--> statement-breakpoint
CREATE POLICY "permissions_update_granter_or_group_owner" ON "permissions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("permissions"."granted_by" = (select auth.uid()) or ("permissions"."entity_type" = 'group' and 
		exists (
			select 1
			from groups g
			where g.id = "permissions"."entity_id"
				and g.owner_id = (select auth.uid())
		)
	)) WITH CHECK ("permissions"."granted_by" = (select auth.uid()) or ("permissions"."entity_type" = 'group' and 
		exists (
			select 1
			from groups g
			where g.id = "permissions"."entity_id"
				and g.owner_id = (select auth.uid())
		)
	));--> statement-breakpoint
CREATE POLICY "permissions_delete_granter_or_group_owner" ON "permissions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("permissions"."granted_by" = (select auth.uid()) or ("permissions"."entity_type" = 'group' and 
		exists (
			select 1
			from groups g
			where g.id = "permissions"."entity_id"
				and g.owner_id = (select auth.uid())
		)
	));--> statement-breakpoint
CREATE POLICY "group_memberships_select_owner_or_member" ON "group_memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from groups g
			where g.id = "group_memberships"."group_id"
				and g.owner_id = (select auth.uid())
		)
	 or 
		exists (
			select 1
			from group_memberships gm
			where gm.group_id = "group_memberships"."group_id"
				and gm.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "group_memberships_insert_owner_or_self_join" ON "group_memberships" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
		exists (
			select 1
			from groups g
			where g.id = "group_memberships"."group_id"
				and g.owner_id = (select auth.uid())
		)
	 or "group_memberships"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "group_memberships_update_owner" ON "group_memberships" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
		exists (
			select 1
			from groups g
			where g.id = "group_memberships"."group_id"
				and g.owner_id = (select auth.uid())
		)
	) WITH CHECK (
		exists (
			select 1
			from groups g
			where g.id = "group_memberships"."group_id"
				and g.owner_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "group_memberships_delete_owner_or_self" ON "group_memberships" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from groups g
			where g.id = "group_memberships"."group_id"
				and g.owner_id = (select auth.uid())
		)
	 or "group_memberships"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "groups_select_owner_or_member" ON "groups" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("groups"."owner_id" = (select auth.uid()) or 
		exists (
			select 1
			from group_memberships gm
			where gm.group_id = "groups"."id"
				and gm.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "groups_insert_self_owner" ON "groups" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("groups"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "groups_update_owner" ON "groups" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("groups"."owner_id" = (select auth.uid())) WITH CHECK ("groups"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "groups_delete_owner" ON "groups" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("groups"."owner_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "tags_select_authenticated" ON "tags" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select (select auth.uid())) is not null);--> statement-breakpoint
CREATE POLICY "tags_insert_authenticated" ON "tags" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select (select auth.uid())) is not null);--> statement-breakpoint
CREATE POLICY "tags_update_authenticated" ON "tags" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select (select auth.uid())) is not null) WITH CHECK ((select (select auth.uid())) is not null);--> statement-breakpoint
CREATE POLICY "tags_delete_authenticated" ON "tags" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select (select auth.uid())) is not null);--> statement-breakpoint
CREATE POLICY "tag_assignments_select_target_member" ON "tag_assignments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
				("tag_assignments"."target_type" = 'asset' and 
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
				or ("tag_assignments"."target_type" = 'scene' and 
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
				or ("tag_assignments"."target_type" = 'folder' and 
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
			);--> statement-breakpoint
CREATE POLICY "tag_assignments_insert_target_member" ON "tag_assignments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				(select (select auth.uid())) is not null
				and (
					("tag_assignments"."target_type" = 'asset' and 
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
					or ("tag_assignments"."target_type" = 'scene' and 
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
					or ("tag_assignments"."target_type" = 'folder' and 
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
				)
			);--> statement-breakpoint
CREATE POLICY "tag_assignments_delete_target_member" ON "tag_assignments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
				("tag_assignments"."target_type" = 'asset' and 
		exists (
			select 1
			from assets a
			join folders f on f.id = a.folder_id
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where a.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
				or ("tag_assignments"."target_type" = 'scene' and 
		exists (
			select 1
			from scenes s
			join projects p on p.id = s.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where s.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
				or ("tag_assignments"."target_type" = 'folder' and 
		exists (
			select 1
			from folders f
			join projects p on p.id = f.project_id
			join organization_memberships om on om.organization_id = p.organization_id
			where f.id = "tag_assignments"."target_id"
				and om.user_id = (select auth.uid())
		)
	)
			);--> statement-breakpoint
CREATE POLICY "api_keys_select_self" ON "api_keys" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("api_keys"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "api_keys_insert_self" ON "api_keys" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("api_keys"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "api_keys_update_self" ON "api_keys" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("api_keys"."user_id" = (select auth.uid())) WITH CHECK ("api_keys"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "api_keys_delete_self" ON "api_keys" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("api_keys"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "api_key_projects_select_owner_and_project_member" ON "api_key_projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
		exists (
			select 1
			from api_keys ak
			where ak.id = "api_key_projects"."api_key_id"
				and ak.user_id = (select auth.uid())
		)
	 and 
		exists (
			select 1
			from projects p
			join organization_memberships om on om.organization_id = p.organization_id
			where p.id = "api_key_projects"."project_id"
				and om.user_id = (select auth.uid())
		)
	);--> statement-breakpoint
CREATE POLICY "api_key_projects_insert_owner_and_project_member" ON "api_key_projects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
				
		exists (
			select 1
			from api_keys ak
			where ak.id = "api_key_projects"."api_key_id"
				and ak.user_id = (select auth.uid())
		)
	
				and 
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
						and ak.user_id = (select auth.uid())
				)
			);--> statement-breakpoint
CREATE POLICY "api_key_projects_delete_owner" ON "api_key_projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (
		exists (
			select 1
			from api_keys ak
			where ak.id = "api_key_projects"."api_key_id"
				and ak.user_id = (select auth.uid())
		)
	);