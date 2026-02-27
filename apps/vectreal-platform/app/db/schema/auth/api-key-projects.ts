import { sql } from 'drizzle-orm'
import {
	index,
	pgPolicy,
	pgTable,
	primaryKey,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'
import { authUid, authenticatedRole } from 'drizzle-orm/supabase'

import { apiKeys } from './api-keys'
import { projects } from '../project/projects'
import { canAccessProject, ownsApiKey } from '../rls'

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
	(table) => [
		primaryKey({ columns: [table.apiKeyId, table.projectId] }),
		index('api_key_projects_api_key_id_idx').on(table.apiKeyId),
		index('api_key_projects_project_id_idx').on(table.projectId),
		pgPolicy('api_key_projects_select_owner_and_project_member', {
			for: 'select',
			to: authenticatedRole,
			using: sql`${ownsApiKey(table.apiKeyId)} and ${canAccessProject(table.projectId)}`
		}),
		pgPolicy('api_key_projects_insert_owner_and_project_member', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: sql`
				${ownsApiKey(table.apiKeyId)}
				and ${canAccessProject(table.projectId)}
				and exists (
					select 1
					from api_keys ak
					where ak.id = ${table.apiKeyId}
						and ak.user_id = ${authUid}
				)
			`
		}),
		pgPolicy('api_key_projects_delete_owner', {
			for: 'delete',
			to: authenticatedRole,
			using: ownsApiKey(table.apiKeyId)
		})
	]
).enableRLS()
