CREATE TYPE "public"."contact_submission_status" AS ENUM('queued', 'sent', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" text NOT NULL,
	"user_id" uuid,
	"source" text DEFAULT 'direct' NOT NULL,
	"is_authenticated" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"inquiry_type" text NOT NULL,
	"message" text NOT NULL,
	"status" "contact_submission_status" DEFAULT 'queued' NOT NULL,
	"failure_stage" text,
	"provider" text DEFAULT 'resend' NOT NULL,
	"internal_message_id" text,
	"confirmation_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_submissions_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_submissions_email_idx" ON "contact_submissions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contact_submissions_status_idx" ON "contact_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_submissions_created_at_idx" ON "contact_submissions" USING btree ("created_at");
