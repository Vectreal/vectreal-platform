/**
 * `upsertAgentGrant` against a real `agent_grants`: the row the consent page
 * writes and the agent API's token check reads to learn which organization a
 * token acts in, with which scopes.
 *
 * One grant per user and client, replaced on re-consent, and never into an
 * organization the user is not a member of. That last one is asserted as a
 * row count too, not only a thrown error.
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

describe('upsertAgentGrant', () => {
	let schema: Schema
	let db: Db
	let repository: Repository

	const userId = randomUUID()
	const otherUserId = randomUUID()
	const memberOrgId = randomUUID()
	const secondMemberOrgId = randomUUID()
	const foreignOrgId = randomUUID()
	const clientId = randomUUID()
	const otherClientId = randomUUID()

	async function grantFor(client: string) {
		const grants = await repository.listAgentGrants(userId)
		return grants.find(({ oauthClientId }) => oauthClientId === client) ?? null
	}

	async function grantsFor(user: string) {
		return db
			.select()
			.from(schema.agentGrants)
			.where(eq(schema.agentGrants.userId, user))
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		repository =
			await import('../../app/lib/domain/agent/agent-grant-repository.server')

		await db.insert(schema.users).values([
			{ id: userId, email: `agent-${userId}@grants.test`, name: 'Agent user' },
			{
				id: otherUserId,
				email: `other-${otherUserId}@grants.test`,
				name: 'Other'
			}
		])
		await db.insert(schema.organizations).values([
			{ id: memberOrgId, name: `grants-${memberOrgId}`, ownerId: userId },
			{
				id: secondMemberOrgId,
				name: `grants-${secondMemberOrgId}`,
				ownerId: userId
			},
			{ id: foreignOrgId, name: `grants-${foreignOrgId}`, ownerId: otherUserId }
		])
		await db.insert(schema.organizationMemberships).values([
			{ userId, organizationId: memberOrgId, role: 'owner' },
			{ userId, organizationId: secondMemberOrgId, role: 'member' },
			{ userId: otherUserId, organizationId: foreignOrgId, role: 'owner' }
		])
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
			.where(
				inArray(schema.organizations.id, [
					memberOrgId,
					secondMemberOrgId,
					foreignOrgId
				])
			)
		await db
			.delete(schema.users)
			.where(inArray(schema.users.id, [userId, otherUserId]))
	})

	it('records the organization and scopes the user approved', async () => {
		const grant = await repository.upsertAgentGrant({
			userId,
			organizationId: memberOrgId,
			oauthClientId: clientId,
			scopes: ['projects:read', 'scenes:write']
		})

		expect(grant).toMatchObject({
			userId,
			organizationId: memberOrgId,
			oauthClientId: clientId,
			scopes: ['projects:read', 'scenes:write']
		})
		expect(await grantFor(clientId)).toMatchObject({ id: grant.id })
	})

	it('replaces the choice on re-consent, keeping one row per client', async () => {
		const before = await grantFor(clientId)

		const after = await repository.upsertAgentGrant({
			userId,
			organizationId: secondMemberOrgId,
			oauthClientId: clientId,
			scopes: ['projects:read']
		})

		expect(after.id).toBe(before?.id)
		expect(after.organizationId).toBe(secondMemberOrgId)
		expect(after.scopes).toEqual(['projects:read'])
		expect(
			(await grantsFor(userId)).filter((g) => g.oauthClientId === clientId)
		).toHaveLength(1)
	})

	it('keeps a separate grant for another client', async () => {
		await repository.upsertAgentGrant({
			userId,
			organizationId: memberOrgId,
			oauthClientId: otherClientId,
			scopes: ['projects:read', 'scenes:publish']
		})

		expect(await grantsFor(userId)).toHaveLength(2)
		expect((await grantFor(clientId))?.organizationId).toBe(secondMemberOrgId)
	})

	it('refuses an organization the user is not a member of, and writes nothing', async () => {
		const strangerClient = randomUUID()

		await expect(
			repository.upsertAgentGrant({
				userId,
				organizationId: foreignOrgId,
				oauthClientId: strangerClient,
				scopes: ['projects:read']
			})
		).rejects.toBeInstanceOf(repository.AgentGrantOrganizationError)

		const written = await db
			.select()
			.from(schema.agentGrants)
			.where(
				and(
					eq(schema.agentGrants.userId, userId),
					eq(schema.agentGrants.oauthClientId, strangerClient)
				)
			)
		expect(written).toHaveLength(0)
	})

	it('does not move an existing grant into a foreign organization', async () => {
		await expect(
			repository.upsertAgentGrant({
				userId,
				organizationId: foreignOrgId,
				oauthClientId: clientId,
				scopes: ['projects:read']
			})
		).rejects.toBeInstanceOf(repository.AgentGrantOrganizationError)

		expect((await grantFor(clientId))?.organizationId).toBe(secondMemberOrgId)
	})
})
