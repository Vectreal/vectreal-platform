-- Migration: Create consent_records table with unique constraints
-- EPIC-5 / Issue #287 — Consent persistence
--
-- Creates the consent_records table (skip if already applied via schema push)
-- and ensures unique constraints exist on user_id and anonymous_id so that
-- the Drizzle ON CONFLICT DO UPDATE upsert can function correctly.
--
-- Rollback strategy:
--   DROP TABLE IF EXISTS consent_records;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consent_records" (
	"id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id"     uuid,
	"anonymous_id" text,
	"version"     text DEFAULT '1.0.0' NOT NULL,
	"necessary"   boolean DEFAULT true NOT NULL,
	"functional"  boolean DEFAULT false NOT NULL,
	"analytics"   boolean DEFAULT false NOT NULL,
	"marketing"   boolean DEFAULT false NOT NULL,
	"ip_country"  text,
	"user_agent"  text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at"  timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_records_user_id_unique" UNIQUE ("user_id"),
	CONSTRAINT "consent_records_anonymous_id_unique" UNIQUE ("anonymous_id"),
	CONSTRAINT "consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE
);

--> statement-breakpoint
-- If the table was already created by a prior schema push without the unique
-- constraints, add them now (IF NOT EXISTS guards are safe to re-run).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consent_records_user_id_unique'
      AND conrelid = 'consent_records'::regclass
  ) THEN
    ALTER TABLE consent_records
      ADD CONSTRAINT consent_records_user_id_unique UNIQUE (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consent_records_anonymous_id_unique'
      AND conrelid = 'consent_records'::regclass
  ) THEN
    ALTER TABLE consent_records
      ADD CONSTRAINT consent_records_anonymous_id_unique UNIQUE (anonymous_id);
  END IF;
END $$;

--> statement-breakpoint
ALTER TABLE "consent_records" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consent_records' AND policyname = 'consent_records_select_self'
  ) THEN
    CREATE POLICY "consent_records_select_self"
      ON "consent_records"
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consent_records' AND policyname = 'consent_records_insert_self'
  ) THEN
    CREATE POLICY "consent_records_insert_self"
      ON "consent_records"
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consent_records' AND policyname = 'consent_records_update_self'
  ) THEN
    CREATE POLICY "consent_records_update_self"
      ON "consent_records"
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
