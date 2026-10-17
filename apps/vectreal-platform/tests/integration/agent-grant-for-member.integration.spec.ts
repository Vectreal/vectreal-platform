/**
 * `findAgentGrantForMember` against real tables: the database half of the
 * agent token check. It decides which organization a token acts in, so it
 * must return nothing once the user has left that organization, even though
 * leaving deletes only the membership and not the grant.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { and, eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Repository =
	typeof import('../../app/lib/domain/agent/agent-grant-repository.server')

describe('findAgentGrantForMember', () => {
	let schema: Schema
	let db: Db
	let repository: Repository

	const userId = randomUUID()
	const otherUserId = randomUUID()
	const orgId = randomUUID()
	const leftOrgId = randomUUID()
	const clientId = randomUUID()
	const leftClientId = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		repository =
			await import('../../app/lib/domain/agent/agent-grant-repository.server')

		await db.insert(schema.users).values([
			{ id: userId, email: `actor-${userId}@grants.test`, name: 'Agent user' },
			{
				id: otherUserId,
				email: `other-${otherUserId}@grants.test`,
				name: 'Other'
			}
		])
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `actor-${orgId}`, ownerId: otherUserId },
			{ id: leftOrgId, name: `actor-${leftOrgId}`, ownerId: otherUserId }
		])
		await db.insert(schema.organizationMemberships).values([
			{ userId, organizationId: orgId, role: 'admin' },
			{ userId, organizationId: leftOrgId, role: 'member' },
			{ userId: otherUserId, organizationId: orgId, role: 'owner' },
			{ userId: otherUserId, organizationId: leftOrgId, role: 'owner' }
		])
		await repository.upsertAgentGrant({
			userId,
			organizationId: orgId,
			oauthClientId: clientId,
			scopes: ['projects:read', 'scenes:write']
		})
		await repository.upsertAgentGrant({
			userId,
			organizationId: leftOrgId,
			oauthClientId: leftClientId,
			scopes: ['projects:read']
		})
		// The other user approved the same client, in an organization of theirs.
		await repository.upsertAgentGrant({
			userId: otherUserId,
			organizationId: leftOrgId,
			oauthClientId: clientId,
			scopes: ['projects:read', 'embed:manage']
		})

		// Leaving the organization removes the membership; the grant stays.
		await db
			.delete(schema.organizationMemberships)
			.where(
				and(
					eq(schema.organizationMemberships.userId, userId),
					eq(schema.organizationMemberships.organizationId, leftOrgId)
				)
			)
	})

	afterAll(async () => {
		await db
			.delete(schema.agentGrants)
			.where(inArray(schema.agentGrants.userId, [userId, otherUserId]))
		await db
			.delete(schema.organizationMemberships)
			.where(
				inArray(schema.organizationMemberships.userId, [userId, otherUserId])
			)
		await db
			.delete(schema.organizations)
			.where(inArray(schema.organizations.id, [orgId, leftOrgId]))
		await db
			.delete(schema.users)
			.where(inArray(schema.users.id, [userId, otherUserId]))
	})

	it('returns the grant with the role the user holds in its organization', async () => {
		const grant = await repository.findAgentGrantForMember(userId, clientId)

		expect(grant).toMatchObject({
			userId,
			organizationId: orgId,
			oauthClientId: clientId,
			scopes: ['projects:read', 'scenes:write'],
			role: 'admin',
			organizationName: `actor-${orgId}`
		})
	})

	it('returns nothing for a client the user never approved', async () => {
		expect(
			await repository.findAgentGrantForMember(userId, randomUUID())
		).toBeNull()
	})

	it('returns nothing once the user has left the grant organization', async () => {
		const [stillThere] = await db
			.select()
			.from(schema.agentGrants)
			.where(
				and(
					eq(schema.agentGrants.userId, userId),
					eq(schema.agentGrants.oauthClientId, leftClientId)
				)
			)
		expect(stillThere).toBeDefined()

		expect(
			await repository.findAgentGrantForMember(userId, leftClientId)
		).toBeNull()
	})

	it("never returns another user's grant for the same client", async () => {
		const grant = await repository.findAgentGrantForMember(
			otherUserId,
			clientId
		)

		expect(grant).toMatchObject({
			userId: otherUserId,
			organizationId: leftOrgId,
			role: 'owner'
		})
	})
})
