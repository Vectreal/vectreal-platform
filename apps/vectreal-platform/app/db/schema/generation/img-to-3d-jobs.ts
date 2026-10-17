import {
	index,
	integer,
	jsonb,
	pgTable,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core'

import { organizations } from '../core/organizations'
import { users } from '../core/users'

import type { ImgTo3dGenerationParams } from '../../../lib/domain/img-to-3d/img-to-3d-contract'

/**
 * One image-to-3D generation: which organization asked for it, and with what.
 *
 * The row is how a job is owned. Reading a job's status or its model requires
 * a row for that id in an organization the caller may generate for, so a job
 * id alone grants nothing. The job's state lives in the runtime for now; the
 * reliability change moves it here.
 *
 * Server-only: RLS on and no policies, so the anon and authenticated roles see
 * nothing through Supabase's REST API. The app reads it with the service
 * connection, behind `resolveImgTo3dAccess`.
 */
export const imgTo3dJobs = pgTable(
	'img_to_3d_jobs',
	{
		/** Chosen by the platform and passed to the runtime, so one id names the job on both sides. */
		id: uuid('id').primaryKey(),
		organizationId: uuid('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		createdBy: uuid('created_by').references(() => users.id, {
			onDelete: 'set null'
		}),
		/** The variants generated from one image in one request share this. */
		batchId: uuid('batch_id').notNull(),
		seed: integer('seed').notNull(),
		params: jsonb('params').$type<ImgTo3dGenerationParams>().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('img_to_3d_jobs_org_created_idx').on(
			table.organizationId,
			table.createdAt
		)
	]
).enableRLS()
