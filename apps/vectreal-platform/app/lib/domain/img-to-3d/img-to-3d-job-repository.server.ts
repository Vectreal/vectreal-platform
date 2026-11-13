import { and, asc, count, desc, eq, gt, inArray, max, sql } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { users } from '../../../db/schema/core/users'
import { imgTo3dJobs } from '../../../db/schema/generation/img-to-3d-jobs'

import type {
	ImgTo3dJobListing,
	ImgTo3dJobRecord,
	ImgTo3dJobStore,
	ImgTo3dOwnedJob
} from './img-to-3d-handlers'

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
	): Promise<ImgTo3dOwnedJob | null> {
		const [job] = await db
			.select({
				id: imgTo3dJobs.id,
				seed: imgTo3dJobs.seed,
				sourceName: imgTo3dJobs.sourceName
			})
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

	async listForOrganization(
		organizationId: string,
		batchLimit: number
	): Promise<readonly ImgTo3dJobListing[]> {
		const recentBatches = db
			.select({ batchId: imgTo3dJobs.batchId })
			.from(imgTo3dJobs)
			.where(eq(imgTo3dJobs.organizationId, organizationId))
			.groupBy(imgTo3dJobs.batchId)
			.orderBy(desc(max(imgTo3dJobs.createdAt)))
			.limit(batchLimit)

		return (
			db
				.select({
					id: imgTo3dJobs.id,
					batchId: imgTo3dJobs.batchId,
					seed: imgTo3dJobs.seed,
					sourceName: imgTo3dJobs.sourceName,
					createdAt: imgTo3dJobs.createdAt,
					createdByName: users.name
				})
				.from(imgTo3dJobs)
				.leftJoin(users, eq(users.id, imgTo3dJobs.createdBy))
				.where(
					and(
						eq(imgTo3dJobs.organizationId, organizationId),
						inArray(imgTo3dJobs.batchId, recentBatches)
					)
				)
				// One batch's jobs share a timestamp, so the batch id keeps them together.
				.orderBy(
					desc(imgTo3dJobs.createdAt),
					asc(imgTo3dJobs.batchId),
					asc(imgTo3dJobs.seed)
				)
		)
	},

	async remove(jobId: string): Promise<void> {
		await db.delete(imgTo3dJobs).where(eq(imgTo3dJobs.id, jobId))
	}
}
