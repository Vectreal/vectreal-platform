import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { organizations } from '../core/organizations'

/**
 * Canonical plan identifiers — kept in sync with prd/01-plans-and-tiers.md
 */
export const planEnum = pgEnum('plan', ['free', 'pro', 'business', 'enterprise'])

/**
 * Subscription lifecycle states — kept in sync with prd/04-billing-states.md
 */
export const billingStateEnum = pgEnum('billing_state', [
	'none',
	'trialing',
	'active',
	'past_due',
	'unpaid',
	'canceled',
	'paused',
	'incomplete',
	'incomplete_expired'
])

/**
 * One subscription record per organisation.
 * Mirrors the billing provider (Stripe) subscription data and tracks the
 * effective plan and lifecycle state used for entitlement resolution.
 */
export const orgSubscriptions = pgTable(
	'org_subscriptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.notNull()
			.unique()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		/** Canonical plan identifier (free / pro / business / enterprise). */
		plan: planEnum('plan').notNull().default('free'),
		/** Subscription lifecycle state. */
		billingState: billingStateEnum('billing_state').notNull().default('none'),
		/** Stripe subscription ID (null for free-tier accounts). */
		stripeSubscriptionId: text('stripe_subscription_id'),
		/** Stripe customer ID (null until the org enters checkout). */
		stripeCustomerId: text('stripe_customer_id'),
		/** ISO-8601 period end from the billing provider. */
		currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
		/** ISO-8601 trial end (set when billing_state = trialing). */
		trialEnd: timestamp('trial_end', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('org_subscriptions_organization_id_idx').on(table.organizationId),
		index('org_subscriptions_stripe_subscription_id_idx').on(
			table.stripeSubscriptionId
		),
		index('org_subscriptions_stripe_customer_id_idx').on(
			table.stripeCustomerId
		),
		index('org_subscriptions_billing_state_idx').on(table.billingState)
	]
)
