import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

import { organizations } from './organizations'
import { users } from './users'

export const membershipRoleEnum = pgEnum('membership_role', [
	'owner',
	'admin',
	'member'
])

export const organizationMemberships = pgTable('organization_memberships', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	organizationId: uuid('organization_id')
		.notNull()
		.references(() => organizations.id, { onDelete: 'cascade' }),
	role: membershipRoleEnum('role').notNull().default('member'),
	joinedAt: timestamp('joined_at').notNull().defaultNow(),
	invitedAt: timestamp('invited_at'),
	invitedBy: uuid('invited_by').references(() => users.id)
})
