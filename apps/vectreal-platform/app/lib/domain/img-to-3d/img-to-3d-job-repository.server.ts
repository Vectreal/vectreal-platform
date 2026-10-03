import { and, eq } from 'drizzle-orm'

import { getDbClient } from '../../../db/client'
import { imgTo3dJobs } from '../../../db/schema/generation/img-to-3d-jobs'

import type { ImgTo3dJobRecord, ImgTo3dJobStore } from './img-to-3d-handlers'

const db = getDbClient()

export const imgTo3dJobStore: ImgTo3dJobStore = {
	async insert(jobs: readonly ImgTo3dJobRecord[]): Promise<void> {
		if (jobs.length === 0) return
		await db.insert(imgTo3dJobs).values([...jobs])
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
