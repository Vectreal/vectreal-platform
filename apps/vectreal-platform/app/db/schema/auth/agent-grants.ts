import {
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core'

import { AGENT_SCOPES } from '../../../lib/domain/agent/agent-scopes'
import { organizations } from '../core/organizations'
import { users } from '../core/users'

/** Read from `agent-scopes.ts`, so the database and the consent page agree. */
export const agentScopeEnum = pgEnum('agent_scope', AGENT_SCOPES)

/**
 * What a user approved on the OAuth consent page for one client: which
 * organization the agent acts in, and with which Vectreal scopes.
 *
 * Whether the access is still valid is not stored here. Supabase owns that:
 * revoking the client's grant deletes its `auth.sessions` row, which is what
 * the agent API's token check reads. This row only says what a valid session
 * may do.
 *
 * `oauth_client_id` is text rather than uuid: Supabase issues uuids today, and
 * a Client ID Metadata Document client would be identified by its URL.
 *
 * RLS enabled with no policy, like every internal table: only the app's own
 * connection reads or writes it.
 */
export const agentGrants = pgTable(
	'agent_grants',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		oauthClientId: text('oauth_client_id').notNull(),
		scopes: agentScopeEnum('scopes').array().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.notNull()
	},
	(table) => [
		uniqueIndex('agent_grants_user_client_idx').on(
			table.userId,
			table.oauthClientId
		),
		index('agent_grants_organization_id_idx').on(table.organizationId)
	]
).enableRLS()
