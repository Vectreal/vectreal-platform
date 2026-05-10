ALTER TABLE "users" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "use_case" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_source" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tos_accepted_at" timestamp with time zone;