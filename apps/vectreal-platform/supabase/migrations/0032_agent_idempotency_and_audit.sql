CREATE TABLE "agent_idempotency_keys" (
	"grant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"claim_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"status_code" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_idempotency_keys_grant_id_key_pk" PRIMARY KEY("grant_id","key")
);
--> statement-breakpoint
ALTER TABLE "agent_idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agent_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"oauth_client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agent_idempotency_keys" ADD CONSTRAINT "agent_idempotency_keys_grant_id_agent_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."agent_grants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_events" ADD CONSTRAINT "agent_audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_idempotency_keys_created_at_idx" ON "agent_idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_audit_events_grant_id_idx" ON "agent_audit_events" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "agent_audit_events_organization_id_idx" ON "agent_audit_events" USING btree ("organization_id");