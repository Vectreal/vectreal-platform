CREATE TYPE "public"."scene_action_request_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "scene_action_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_key" text NOT NULL,
	"action" text NOT NULL,
	"request_id" text NOT NULL,
	"scene_id" uuid,
	"user_id" text NOT NULL,
	"status" "scene_action_request_status" DEFAULT 'pending' NOT NULL,
	"response_status" integer,
	"response_body" json,
	"error_message" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scene_action_requests_request_key_unique" UNIQUE("request_key")
);
--> statement-breakpoint
CREATE TABLE "scene_action_locks" (
	"scene_id" uuid PRIMARY KEY NOT NULL,
	"holder_key" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_runtime_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"in_flight" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "scene_action_requests_status_idx" ON "scene_action_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scene_action_requests_scene_id_idx" ON "scene_action_requests" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_action_requests_expires_at_idx" ON "scene_action_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "scene_action_locks_expires_at_idx" ON "scene_action_locks" USING btree ("expires_at");