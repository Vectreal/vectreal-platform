import {
	pgPolicy,
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { organizations } from '../core/organizations'
import { users } from '../core/users'
import { canManageOrgApiKeys } from '../rls'

/**
 * What a key is for, which decides whether its owner may read it back.
 *
 * One value today, and the enum exists because of the second one. Every row in
 * this table is an embed token: published by design into an `iframe src` on a
 * customer's page, restricted by the allowed-domain list rather than by
 * secrecy, and therefore safe to hand back to the owner who minted it.
 *
 * A key with write scope would not be. Without this column the default for such
 * a row is whatever the reveal path happens to do - which is "show it" - and
 * nothing would force the person adding that kind to notice. With it, adding a
 * value is a migration and `api-key-disclosure.server.ts` is a compile-time
 * stop, so the choice has to be made out loud.
 */
export const apiKeyKindEnum = pgEnum('api_key_kind', ['embed'])

export const apiKeys = pgTable(
	'api_keys',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		/*
		  Defaulted so the rows that predate this column are what they have always
		  been. Every one of them is an embed token, minted by a form that could
		  create nothing else, so backfilling them as `embed` states a fact rather
		  than guessing one.

		  `createApiKey` still passes it explicitly. A default is for existing
		  rows; a mint site should say what it is minting.
		*/
		kind: apiKeyKindEnum('kind').notNull().default('embed'),
		hashedKey: text('hashed_key').notNull(),
		/*
		  The same secret, kept readable, so the embed panel can offer a key the
		  owner already made instead of asking them to paste one back.

		  Not a weakening of `hashedKey`, which stays the only thing an embed
		  request is matched against. This token is published by design - it goes
		  into an `iframe src` on the customer's own page - and the allowed-domain
		  list, not its secrecy, is what restricts it. Encrypted at rest all the
		  same, so a database dump does not hand over working embed tokens for
		  every customer at once.

		  Nullable, and permanently so for rows written before this column: their
		  plaintext was never kept and cannot be recovered. Rotating such a key is
		  the way back, and it already exists.
		*/
		encryptedKey: text('encrypted_key'),
		keyPreview: text('key_preview').notNull(),
		active: boolean('active').default(true),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		/*
		  When the secret behind this row last changed. Null means never rotated.

		  Read next to `lastUsedAt`, it answers the question that follows every
		  rotation: rotated three days ago but last used five days ago means the
		  embed still carrying the old key was never updated, and that storefront
		  is broken right now.
		*/
		rotatedAt: timestamp('rotated_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('api_keys_organization_id_idx').on(table.organizationId),
		index('api_keys_user_id_idx').on(table.userId),
		pgPolicy('api_keys_select_org_admin', {
			for: 'select',
			to: authenticatedRole,
			using: canManageOrgApiKeys(table.organizationId)
		}),
		pgPolicy('api_keys_insert_org_admin', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: canManageOrgApiKeys(table.organizationId)
		}),
		pgPolicy('api_keys_update_org_admin', {
			for: 'update',
			to: authenticatedRole,
			using: canManageOrgApiKeys(table.organizationId),
			withCheck: canManageOrgApiKeys(table.organizationId)
		}),
		pgPolicy('api_keys_delete_org_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageOrgApiKeys(table.organizationId)
		})
	]
).enableRLS()
