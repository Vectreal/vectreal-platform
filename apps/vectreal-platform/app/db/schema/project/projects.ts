import { pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { organizations } from '../core/organizations'

export const projects = pgTable('projects', {
	id: uuid('id').primaryKey().defaultRandom(),
	organizationId: uuid('organization_id')
		.notNull()
		.references(() => organizations.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique()
})
