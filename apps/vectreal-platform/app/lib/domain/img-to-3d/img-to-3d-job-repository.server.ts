import { and, count, eq, gt, sql } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { imgTo3dJobs } from '../../../db/schema/generation/img-to-3d-jobs'

import type { ImgTo3dJobRecord, ImgTo3dJobStore } from './img-to-3d-handlers'

const db = getDbClient()

export const imgTo3dJobStore: ImgTo3dJobStore = {
	/**
	 * Counts and inserts in one transaction, under a lock held per person, so
	 * two submits sent at once cannot both read a count from before the other
	 * inserted.
	 */
	async insertWithinDailyLimit(
		jobs: readonly ImgTo3dJobRecord[],
		userId: string,
		limit: number
	): Promise<boolean> {
		return db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`img-to-3d:${userId}`}))`
			)
			const [row] = await tx
				.select({ started: count() })
				.from(imgTo3dJobs)
				.where(
					and(
						eq(imgTo3dJobs.createdBy, userId),
						gt(imgTo3dJobs.createdAt, sql`now() - interval '24 hours'`)
					)
				)
			if ((row?.started ?? 0) + jobs.length > limit) return false
			if (jobs.length > 0) await tx.insert(imgTo3dJobs).values([...jobs])
			return true
		})
	},

	/** The job, only if it belongs to `organizationId`. */
	async findForOrganization(
		jobId: string,
		organizationId: string
	): Promise<{ id: string } | null> {
		const [job] = await db
			.select({ id: imgTo3dJobs.id })
			.from(imgTo3dJobs)
			.where(
				and(
					eq(imgTo3dJobs.id, jobId),
					eq(imgTo3dJobs.organizationId, organizationId)
				)
			)
			.limit(1)
		return job ?? null
	},

	async remove(jobId: string): Promise<void> {
		await db.delete(imgTo3dJobs).where(eq(imgTo3dJobs.id, jobId))
	}
}
