import { index, pgPolicy, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase'

import { organizations } from '../core/organizations'
import { canAccessProject, canManageProject, isOrganizationAdmin } from '../rls'

export const projects = pgTable(
	'projects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique()
	},
	(table) => [
		index('projects_organization_id_idx').on(table.organizationId),
		pgPolicy('projects_select_org_member', {
			for: 'select',
			to: authenticatedRole,
			using: canAccessProject(table.id)
		}),
		pgPolicy('projects_insert_org_admin', {
			for: 'insert',
			to: authenticatedRole,
			withCheck: isOrganizationAdmin(table.organizationId)
		}),
		pgPolicy('projects_update_org_admin', {
			for: 'update',
			to: authenticatedRole,
			using: canManageProject(table.id),
			withCheck: canManageProject(table.id)
		}),
		pgPolicy('projects_delete_org_admin', {
			for: 'delete',
			to: authenticatedRole,
			using: canManageProject(table.id)
		})
	]
).enableRLS()
