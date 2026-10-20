/**
 * The image-to-3D job store, against real rows.
 *
 * Two rules live in its SQL rather than in the handlers the unit specs cover:
 * a job is visible only to its own organization, which is all that keeps one
 * account polling or downloading another's model, and the daily limit counts
 * one person's jobs over the last 24 hours, which is all that bounds their GPU
 * spend. A fake store can only agree with itself on either.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a fresh uuid and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type JobRepo =
	typeof import('../../app/lib/domain/img-to-3d/img-to-3d-job-repository.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

const PARAMS = {
	resolution: 1024,
	textureSize: 2048,
	decimationTarget: 200_000
}

describe('image-to-3D job store', () => {
	// Loaded in `beforeAll`: these modules call `getDbClient()` on import.
	let schema: Schema
	let jobs: JobRepo['imgTo3dJobStore']
	let db: Db

	const userId = randomUUID()
	const otherUserId = randomUUID()
	const orgId = randomUUID()
	const otherOrgId = randomUUID()
	const batchId = randomUUID()

	const recent = [randomUUID(), randomUUID()]
	const dayOld = randomUUID()
	const othersJob = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ imgTo3dJobStore: jobs } =
			await import('../../app/lib/domain/img-to-3d/img-to-3d-job-repository.server'))
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.users).values([
			{ id: userId, email: `img-${userId}@smoke.test`, name: 'Generator' },
			{ id: otherUserId, email: `img-${otherUserId}@smoke.test`, name: 'Other' }
		])
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `smoke-${orgId}`, ownerId: userId },
			{ id: otherOrgId, name: `smoke-${otherOrgId}`, ownerId: otherUserId }
		])

		const row = (id: string, createdBy: string, organizationId: string) => ({
			id,
			organizationId,
			createdBy,
			batchId,
			seed: 1,
			params: PARAMS
		})
		// Through the store, as the submit handler writes them.
		await jobs.insert([
			...recent.map((id) => row(id, userId, orgId)),
			row(othersJob, otherUserId, otherOrgId)
		])
		// Just outside the window: written directly, since the store stamps now.
		await db.insert(schema.imgTo3dJobs).values({
			...row(dayOld, userId, orgId),
			createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 60_000)
		})
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(inArray(schema.organizations.id, [orgId, otherOrgId]))
		await db
			.delete(schema.users)
			.where(inArray(schema.users.id, [userId, otherUserId]))
	})

	it('counts only this person’s jobs from the last 24 hours', async () => {
		expect(await jobs.countStartedInLastDay(userId)).toBe(recent.length)
		expect(await jobs.countStartedInLastDay(otherUserId)).toBe(1)
	})

	it('finds a job only for the organization that owns it', async () => {
		expect(await jobs.findForOrganization(recent[0], orgId)).toEqual({
			id: recent[0]
		})
		expect(await jobs.findForOrganization(othersJob, orgId)).toBeNull()
	})

	it('removes a job, which then no longer counts', async () => {
		await jobs.remove(recent[1])

		expect(await jobs.findForOrganization(recent[1], orgId)).toBeNull()
		expect(await jobs.countStartedInLastDay(userId)).toBe(recent.length - 1)
	})
})
