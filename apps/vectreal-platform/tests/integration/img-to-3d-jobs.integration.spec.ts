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

import { inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type JobRepo =
	typeof import('../../app/lib/domain/img-to-3d/img-to-3d-job-repository.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

const PARAMS = {
	resolution: 1024,
	textureSize: 2048,
	decimationTarget: 200_000
} as const

describe('image-to-3D job store', () => {
	// Loaded in `beforeAll`: these modules call `getDbClient()` on import.
	let schema: Schema
	let jobs: JobRepo['imgTo3dJobStore']
	let db: Db

	const userId = randomUUID()
	const otherUserId = randomUUID()
	const racerId = randomUUID()
	const orgId = randomUUID()
	const otherOrgId = randomUUID()
	const batchId = randomUUID()

	const recent = [randomUUID(), randomUUID()]
	const dayOld = randomUUID()
	const othersJob = randomUUID()

	const row = (id: string, createdBy: string, organizationId: string) => ({
		id,
		organizationId,
		createdBy,
		batchId,
		seed: 1,
		params: PARAMS
	})

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ imgTo3dJobStore: jobs } =
			await import('../../app/lib/domain/img-to-3d/img-to-3d-job-repository.server'))
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.users).values(
			[userId, otherUserId, racerId].map((id) => ({
				id,
				email: `img-${id}@smoke.test`,
				name: 'Generator'
			}))
		)
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `smoke-${orgId}`, ownerId: userId },
			{ id: otherOrgId, name: `smoke-${otherOrgId}`, ownerId: otherUserId }
		])

		// Through the store, as the submit handler writes them.
		expect(
			await jobs.insertWithinDailyLimit(
				recent.map((id) => row(id, userId, orgId)),
				userId,
				60
			)
		).toBe(true)
		expect(
			await jobs.insertWithinDailyLimit(
				[row(othersJob, otherUserId, otherOrgId)],
				otherUserId,
				60
			)
		).toBe(true)
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
			.where(inArray(schema.users.id, [userId, otherUserId, racerId]))
	})

	it('counts only this person’s jobs from the last 24 hours against the limit', async () => {
		const extra = randomUUID()
		// Two recent jobs of theirs; the day-old one and the other person's do not count.
		expect(
			await jobs.insertWithinDailyLimit([row(extra, userId, orgId)], userId, 3)
		).toBe(true)
		expect(
			await jobs.insertWithinDailyLimit(
				[row(randomUUID(), userId, orgId)],
				userId,
				3
			)
		).toBe(false)
		await jobs.remove(extra)
	})

	it('records nothing from a refused batch', async () => {
		const refused = [randomUUID(), randomUUID()]

		expect(
			await jobs.insertWithinDailyLimit(
				refused.map((id) => row(id, userId, orgId)),
				userId,
				3
			)
		).toBe(false)
		expect(await jobs.findForOrganization(refused[0], orgId)).toBeNull()
	})

	it('waits for a concurrent reservation by the same person, then counts what it wrote', async () => {
		// The other writer, held open mid-transaction: it has taken the lock and
		// used up the limit, but not committed. Racing two real calls cannot
		// show this, because they rarely overlap on a fresh pool.
		let release!: () => void
		const held = new Promise<void>((resolve) => (release = resolve))
		let locked!: () => void
		const lockTaken = new Promise<void>((resolve) => (locked = resolve))

		const writer = db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`img-to-3d:${racerId}`}))`
			)
			await tx
				.insert(schema.imgTo3dJobs)
				.values(row(randomUUID(), racerId, orgId))
			locked()
			await held
		})
		await lockTaken

		let settled = false
		const reservation = jobs
			.insertWithinDailyLimit([row(randomUUID(), racerId, orgId)], racerId, 1)
			.finally(() => (settled = true))

		await new Promise((resolve) => setTimeout(resolve, 300))
		expect(settled).toBe(false)

		release()
		await writer
		expect(await reservation).toBe(false)
	})

	it('finds a job only for the organization that owns it', async () => {
		expect(await jobs.findForOrganization(recent[0], orgId)).toEqual({
			id: recent[0]
		})
		expect(await jobs.findForOrganization(othersJob, orgId)).toBeNull()
	})

	it('removes a job', async () => {
		await jobs.remove(recent[1])
		expect(await jobs.findForOrganization(recent[1], orgId)).toBeNull()
	})
})
