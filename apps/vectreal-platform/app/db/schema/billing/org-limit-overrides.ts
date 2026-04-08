import {
	bigint,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { organizations } from '../core/organizations'
import { isOrganizationAdmin, isOrganizationMember } from '../rls'

/**
 * Enterprise-level overrides for numeric quota limits.
 * Each row overrides one limit key for one organisation.
 * A NULL value for `limit_value` means "Unlimited".
 *
 * Limit keys are defined in prd/02-limits-and-quotas.md.
 */
export const orgLimitOverrides = pgTable(
	'org_limit_overrides',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		/** Canonical limit key, e.g. "storage_bytes_total". */
		limitKey: text('limit_key').notNull(),
		/**
		 * Override value in the limit's native unit.
		 * NULL means unlimited (used for enterprise "Custom" entries).
		 */
		limitValue: bigint('limit_value', { mode: 'bigint' }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('org_limit_overrides_org_key_uidx').on(
			table.organizationId,
			table.limitKey
		),
		pgPolicy('org_limit_overrides_select_org_member', {
			for: 'select',
			to: authenticatedRole,
			using: isOrganizationMember(table.organizationId)
		}),
		pgPolicy('org_limit_overrides_insert_org_admin', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: isOrganizationAdmin(table.organizationId)
		}),
		pgPolicy('org_limit_overrides_update_org_admin', {
			for: 'update',
			to: authenticatedRole,
			using: isOrganizationAdmin(table.organizationId),
			withCheck: isOrganizationAdmin(table.organizationId)
		}),
		pgPolicy('org_limit_overrides_delete_org_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: isOrganizationAdmin(table.organizationId)
		})
	]
).enableRLS()
