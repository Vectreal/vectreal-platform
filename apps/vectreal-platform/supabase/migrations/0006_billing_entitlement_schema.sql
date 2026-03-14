-- Migration: Add billing and entitlement schema
-- Issue #266: Add billing and entitlement schema migrations

-- plan enum
CREATE TYPE "public"."plan" AS ENUM('free', 'pro', 'business', 'enterprise');--> statement-breakpoint

-- billing_state enum
CREATE TYPE "public"."billing_state" AS ENUM('none', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'paused', 'incomplete', 'incomplete_expired');--> statement-breakpoint

-- billing_webhook_event_status enum
CREATE TYPE "public"."billing_webhook_event_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint

-- org_subscriptions: one row per organisation; mirrors billing-provider state
CREATE TABLE "org_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"billing_state" "billing_state" DEFAULT 'none' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"current_period_end" timestamp with time zone,
	"trial_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_subscriptions_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint

-- org_limit_overrides: enterprise-level numeric quota overrides
CREATE TABLE "org_limit_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"limit_key" text NOT NULL,
	"limit_value" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- org_entitlement_overrides: per-org feature flag overrides (add-ons)
CREATE TABLE "org_entitlement_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entitlement_key" text NOT NULL,
	"granted" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- org_usage_counters: rolling usage tracking per org / counter key / window
CREATE TABLE "org_usage_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"counter_key" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- billing_webhook_events: idempotency registry for billing provider webhooks
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" "billing_webhook_event_status" DEFAULT 'pending' NOT NULL,
	"payload" json,
	"error_message" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Foreign keys
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_organization_id_organizations_id_fk"
	FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_limit_overrides" ADD CONSTRAINT "org_limit_overrides_organization_id_organizations_id_fk"
	FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_entitlement_overrides" ADD CONSTRAINT "org_entitlement_overrides_organization_id_organizations_id_fk"
	FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_usage_counters" ADD CONSTRAINT "org_usage_counters_organization_id_organizations_id_fk"
	FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Indexes for org_subscriptions
CREATE INDEX "org_subscriptions_organization_id_idx" ON "org_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_subscriptions_stripe_subscription_id_idx" ON "org_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "org_subscriptions_stripe_customer_id_idx" ON "org_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "org_subscriptions_billing_state_idx" ON "org_subscriptions" USING btree ("billing_state");--> statement-breakpoint

-- Indexes for org_limit_overrides
CREATE INDEX "org_limit_overrides_org_key_idx" ON "org_limit_overrides" USING btree ("organization_id", "limit_key");--> statement-breakpoint

-- Indexes for org_entitlement_overrides
CREATE INDEX "org_entitlement_overrides_org_key_idx" ON "org_entitlement_overrides" USING btree ("organization_id", "entitlement_key");--> statement-breakpoint

-- Indexes for org_usage_counters
CREATE INDEX "org_usage_counters_org_key_window_idx" ON "org_usage_counters" USING btree ("organization_id", "counter_key", "window_start");--> statement-breakpoint
CREATE INDEX "org_usage_counters_window_end_idx" ON "org_usage_counters" USING btree ("window_end");--> statement-breakpoint

-- Indexes for billing_webhook_events
CREATE INDEX "billing_webhook_events_provider_event_id_idx" ON "billing_webhook_events" USING btree ("provider", "provider_event_id");--> statement-breakpoint
CREATE INDEX "billing_webhook_events_status_idx" ON "billing_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_webhook_events_created_at_idx" ON "billing_webhook_events" USING btree ("created_at");
