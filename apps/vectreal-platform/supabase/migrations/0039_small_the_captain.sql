CREATE TABLE "model_intake_letter_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"letter_code" text NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_intake_letter_scans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "model_intake_letters" (
	"code" text PRIMARY KEY NOT NULL,
	"organization" text NOT NULL,
	"category" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_intake_letters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "model_intake_submissions" ADD COLUMN "letter_code" text;--> statement-breakpoint
ALTER TABLE "model_intake_letter_scans" ADD CONSTRAINT "model_intake_letter_scans_letter_code_model_intake_letters_code_fk" FOREIGN KEY ("letter_code") REFERENCES "public"."model_intake_letters"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_intake_letter_scans_letter_code_idx" ON "model_intake_letter_scans" USING btree ("letter_code");--> statement-breakpoint
ALTER TABLE "model_intake_submissions" ADD CONSTRAINT "model_intake_submissions_letter_code_model_intake_letters_code_fk" FOREIGN KEY ("letter_code") REFERENCES "public"."model_intake_letters"("code") ON DELETE set null ON UPDATE no action;