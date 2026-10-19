import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { organizations } from '../core/organizations'
import { users } from '../core/users'

/**
 * Every change an agent made: which grant, which operation, on what.
 *
 * `grant_id` has no foreign key on purpose. Revoking a grant deletes its row,
 * and the record of what that agent did must outlive it; the client id is
 * kept beside it for the same reason. The user and organization cascade: a
 * deleted account takes its history with it.
 *
 * RLS enabled with no policy, like every internal table.
 */
export const agentAuditEvents = pgTable(
	'agent_audit_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		grantId: uuid('grant_id').notNull(),
		oauthClientId: text('oauth_client_id').notNull(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		/** A `DashboardOperation`, such as `project:create`. */
		operation: text('operation').notNull(),
		targetId: uuid('target_id').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('agent_audit_events_grant_id_idx').on(table.grantId),
		index('agent_audit_events_organization_id_idx').on(table.organizationId)
	]
).enableRLS()
