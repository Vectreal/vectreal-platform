/**
 * One membership per user and organization, against real rows.
 *
 * Every membership join assumes it: a second row for the same pair lists each
 * of that organization's scenes twice and counts the user against two seats.
 * The invite checks for an existing member first, but a check is not a
 * constraint, so only the unique index holds the rule, and an invite that
 * loses a race to it must still say why.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a fresh uuid and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { count, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type OrgRepo =
	typeof import('../../app/lib/domain/organization/organization-repository.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('organization memberships', () => {
	// Loaded in `beforeAll`: these modules call `getDbClient()` on import.
	let schema: Schema
	let orgRepo: OrgRepo
	let db: Db

	const userId = randomUUID()
	const inviteeId = randomUUID()
	const organizationId = randomUUID()

	const countMemberships = async () => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.organizationMemberships)
			.where(eq(schema.organizationMemberships.organizationId, organizationId))
		return row?.total ?? 0
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		orgRepo =
			await import('../../app/lib/domain/organization/organization-repository.server')
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.users).values([
			{ id: userId, email: `owner-${userId}@smoke.test`, name: 'Owner' },
			{
				id: inviteeId,
				email: `invitee-${inviteeId}@smoke.test`,
				name: 'Invitee'
			}
		])
		await db.insert(schema.organizations).values({
			id: organizationId,
			name: `smoke-${organizationId}`,
			ownerId: userId
		})
		await db
			.insert(schema.organizationMemberships)
			.values({ userId, organizationId, role: 'owner' })
		// Seats are not what this spec is about; a free plan allows only one.
		await db.insert(schema.orgLimitOverrides).values({
			organizationId,
			limitKey: 'org_seats',
			limitValue: BigInt(10)
		})
	})

	afterAll(async () => {
		// Organizations cascade to memberships and overrides.
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, userId))
		await db.delete(schema.users).where(eq(schema.users.id, inviteeId))
	})

	it('refuses a second row for the same user and organization', async () => {
		await expect(
			db
				.insert(schema.organizationMemberships)
				.values({ userId, organizationId, role: 'member' })
		).rejects.toMatchObject({
			cause: { constraint_name: 'organization_memberships_user_org_uidx' }
		})

		expect(await countMemberships()).toBe(1)
	})

	it('refuses an invite that loses the race as an existing member', async () => {
		/*
		  The rival membership is inserted but not committed, so the invite's own
		  check cannot see it and the invite reaches its insert, which then waits
		  on the index. Committing only once a backend is seen blocked by this
		  transaction makes the race happen every run instead of by chance.
		*/
		let invite: Promise<unknown> | undefined

		await db.transaction(async (tx) => {
			await tx
				.insert(schema.organizationMemberships)
				.values({ userId: inviteeId, organizationId, role: 'member' })
			const [{ pid }] = await tx.execute<{ pid: number }>(
				sql`select pg_backend_pid() as pid`
			)

			invite = orgRepo.inviteOrganizationMember(
				organizationId,
				userId,
				inviteeId,
				'member'
			)
			invite.catch(() => undefined)

			for (let attempt = 0; attempt < 100; attempt++) {
				const waiting = await db.execute(sql`
					select 1 from pg_stat_activity
					where ${pid} = any(pg_blocking_pids(pid))
				`)
				if (waiting.length > 0) return
				await new Promise((resolve) => setTimeout(resolve, 20))
			}
			throw new Error('The invite never reached its insert')
		})

		await expect(invite).rejects.toThrow(
			'User is already a member of this organization'
		)
		expect(await countMemberships()).toBe(2)
	})
})
