CREATE TABLE "img_to_3d_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by" uuid,
	"batch_id" uuid NOT NULL,
	"seed" integer NOT NULL,
	"params" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "img_to_3d_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "img_to_3d_jobs" ADD CONSTRAINT "img_to_3d_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "img_to_3d_jobs" ADD CONSTRAINT "img_to_3d_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "img_to_3d_jobs_org_created_idx" ON "img_to_3d_jobs" USING btree ("organization_id","created_at");