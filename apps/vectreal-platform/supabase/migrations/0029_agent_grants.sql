CREATE TYPE "public"."agent_scope" AS ENUM('projects:read', 'projects:write', 'scenes:write', 'scenes:publish', 'embed:manage');--> statement-breakpoint
CREATE TABLE "agent_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"oauth_client_id" text NOT NULL,
	"scopes" "agent_scope"[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_grants" ADD CONSTRAINT "agent_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_grants" ADD CONSTRAINT "agent_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_grants_user_client_idx" ON "agent_grants" USING btree ("user_id","oauth_client_id");--> statement-breakpoint
CREATE INDEX "agent_grants_organization_id_idx" ON "agent_grants" USING btree ("organization_id");