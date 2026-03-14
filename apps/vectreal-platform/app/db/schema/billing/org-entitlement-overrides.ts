import {
	boolean,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core'

import { organizations } from '../core/organizations'

/**
 * Per-organisation entitlement overrides — used for enterprise add-ons
 * or manual capability grants that differ from the plan baseline.
 *
 * Entitlement keys are defined in prd/03-entitlements.md.
 */
export const orgEntitlementOverrides = pgTable(
	'org_entitlement_overrides',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		/** Canonical entitlement key, e.g. "embed_branding_removal". */
		entitlementKey: text('entitlement_key').notNull(),
		/** true = grant, false = revoke (overrides plan baseline). */
		granted: boolean('granted').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('org_entitlement_overrides_org_key_uidx').on(
			table.organizationId,
			table.entitlementKey
		)
	]
)
