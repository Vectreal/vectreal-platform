import {
	index,
	pgEnum,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { ALL_BILLING_STATES, ALL_PLANS } from '../../../constants/plan-config'
import { organizations } from '../core/organizations'
import { isOrganizationAdmin, isOrganizationMember } from '../rls'

/**
 * Canonical plan identifiers.
 *
 * Read from `plan-config.ts` rather than restated. This used to say it was
 * "kept in sync" with that module, which is what a mirror says: nothing made
 * the two agree, and a plan added to one would have been accepted by the
 * TypeScript union while the Postgres type rejected every row carrying it.
 */
export const planEnum = pgEnum('plan', ALL_PLANS)

/**
 * Subscription lifecycle states.
 *
 * Read from `plan-config.ts`, for the reason given above: this carried the same
 * "kept in sync" comment, and nothing made it true.
 */
export const billingStateEnum = pgEnum('billing_state', ALL_BILLING_STATES)

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
		index('org_subscriptions_stripe_subscription_id_idx').on(
			table.stripeSubscriptionId
		),
		index('org_subscriptions_stripe_customer_id_idx').on(
			table.stripeCustomerId
		),
		index('org_subscriptions_billing_state_idx').on(table.billingState),
		pgPolicy('org_subscriptions_select_org_member', {
			for: 'select',
			to: authenticatedRole,
			using: isOrganizationMember(table.organizationId)
		}),
		pgPolicy('org_subscriptions_insert_org_admin', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: isOrganizationAdmin(table.organizationId)
		}),
		pgPolicy('org_subscriptions_update_org_admin', {
			for: 'update',
			to: authenticatedRole,
			using: isOrganizationAdmin(table.organizationId),
			withCheck: isOrganizationAdmin(table.organizationId)
		}),
		pgPolicy('org_subscriptions_delete_org_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: isOrganizationAdmin(table.organizationId)
		})
	]
).enableRLS()
