import {
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { agentGrants } from './agent-grants'

/**
 * One row per `Idempotency-Key` an agent sent with a mutation, so a retry
 * answers with the first request's outcome instead of running it again.
 *
 * Keyed by grant, not by key alone: two agents choosing the same key never
 * see each other's results, and revoking a grant takes its keys with it.
 * `status_code` is null while the first request is still running. Rows older
 * than a day are expired (see `agent-idempotency.server.ts`).
 *
 * `claim_id` names the request that holds the key. A takeover replaces it, so
 * a request whose claim was taken over can no longer complete or release it.
 *
 * RLS enabled with no policy, like every internal table: only the app's own
 * connection reads or writes it.
 */
export const agentIdempotencyKeys = pgTable(
	'agent_idempotency_keys',
	{
		grantId: uuid('grant_id')
			.notNull()
			.references(() => agentGrants.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		claimId: uuid('claim_id').defaultRandom().notNull(),
		/** sha256 of the method, path and canonical body the key was first sent with. */
		fingerprint: text('fingerprint').notNull(),
		statusCode: integer('status_code'),
		responseBody: jsonb('response_body'),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull()
	},
	(table) => [
		primaryKey({ columns: [table.grantId, table.key] }),
		index('agent_idempotency_keys_created_at_idx').on(table.createdAt)
	]
).enableRLS()
