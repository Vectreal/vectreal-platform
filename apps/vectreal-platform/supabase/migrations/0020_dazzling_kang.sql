CREATE TYPE "public"."api_key_kind" AS ENUM('embed');--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "kind" "api_key_kind" DEFAULT 'embed' NOT NULL;