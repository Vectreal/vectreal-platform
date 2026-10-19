CREATE TYPE "public"."model_intake_email_status" AS ENUM('queued', 'sent', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."model_intake_outcome" AS ENUM('usable', 'unusable');--> statement-breakpoint
CREATE TYPE "public"."model_intake_status" AS ENUM('received', 'in_cleanup', 'delivered', 'pilot_booked');--> statement-breakpoint
CREATE TABLE "model_intake_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" text NOT NULL,
	"locale" text NOT NULL,
	"batch" text NOT NULL,
	"product_type" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text NOT NULL,
	"message" text,
	"height_cm" real,
	"width_cm" real,
	"depth_cm" real,
	"photo_paths" text[] NOT NULL,
	"consent_version" text NOT NULL,
	"consent_follow_up_at" timestamp with time zone NOT NULL,
	"consent_photos_at" timestamp with time zone NOT NULL,
	"email_status" "model_intake_email_status" DEFAULT 'queued' NOT NULL,
	"status" "model_intake_status" DEFAULT 'received' NOT NULL,
	"cleanup_started_at" timestamp with time zone,
	"cleanup_finished_at" timestamp with time zone,
	"cleanup_minutes" integer,
	"outcome" "model_intake_outcome",
	"delivered_at" timestamp with time zone,
	"delete_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_intake_submissions_reference_code_unique" UNIQUE("reference_code")
);
--> statement-breakpoint
ALTER TABLE "model_intake_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "model_intake_submissions_batch_idx" ON "model_intake_submissions" USING btree ("batch");--> statement-breakpoint
CREATE INDEX "model_intake_submissions_created_at_idx" ON "model_intake_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "model_intake_submissions_delete_after_idx" ON "model_intake_submissions" USING btree ("delete_after");