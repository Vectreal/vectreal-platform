CREATE TABLE "model_intake_letters" (
	"code" text PRIMARY KEY NOT NULL,
	"organization" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "model_intake_letters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "model_intake_submissions" ADD COLUMN "letter_code" text;--> statement-breakpoint
ALTER TABLE "model_intake_submissions" ADD CONSTRAINT "model_intake_submissions_letter_code_model_intake_letters_code_fk" FOREIGN KEY ("letter_code") REFERENCES "public"."model_intake_letters"("code") ON DELETE set null ON UPDATE no action;