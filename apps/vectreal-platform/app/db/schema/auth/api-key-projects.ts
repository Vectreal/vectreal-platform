import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'

import { apiKeys } from './api-keys'
import { projects } from '../project/projects'

export const apiKeyProjects = pgTable(
	'api_key_projects',
	{
		apiKeyId: uuid('api_key_id')
			.notNull()
			.references(() => apiKeys.id, { onDelete: 'cascade' }),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.defaultNow()
			.notNull()
	},
	(table) => ({
		pk: primaryKey({ columns: [table.apiKeyId, table.projectId] })
	})
)
