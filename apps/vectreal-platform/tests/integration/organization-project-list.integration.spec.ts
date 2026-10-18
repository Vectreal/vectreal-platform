/**
 * `listOrganizationProjects` against real tables: what `GET /api/v1/projects`
 * answers. It must return one organization's projects and nothing from
 * another, sorted by name, and carry no field beyond id, name and slug.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Repository =
	typeof import('../../app/lib/domain/project/project-repository.server')

describe('listOrganizationProjects', () => {
	let schema: Schema
	let db: Db
	let repository: Repository

	const ownerId = randomUUID()
	const orgId = randomUUID()
	const otherOrgId = randomUUID()
	const tag = ownerId.slice(0, 8)

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		repository =
			await import('../../app/lib/domain/project/project-repository.server')

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@projects.test`,
			name: 'Owner'
		})
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `list-${orgId}`, ownerId },
			{ id: otherOrgId, name: `list-${otherOrgId}`, ownerId }
		])
		await db.insert(schema.projects).values([
			{
				organizationId: orgId,
				name: 'Tables',
				slug: `tables-${tag}`,
				allowedEmbedDomains: 'shop.example'
			},
			{ organizationId: orgId, name: 'Chairs', slug: `chairs-${tag}` },
			{ organizationId: otherOrgId, name: 'Lamps', slug: `lamps-${tag}` }
		])
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(inArray(schema.organizations.id, [orgId, otherOrgId]))
		await db.delete(schema.users).where(inArray(schema.users.id, [ownerId]))
	})

	it("returns one organization's projects by name, and only id, name and slug", async () => {
		const listed = await repository.listOrganizationProjects(orgId)

		expect(listed).toEqual([
			{ id: expect.any(String), name: 'Chairs', slug: `chairs-${tag}` },
			{ id: expect.any(String), name: 'Tables', slug: `tables-${tag}` }
		])
	})

	it('returns nothing for an organization without projects', async () => {
		await expect(
			repository.listOrganizationProjects(randomUUID())
		).resolves.toEqual([])
	})
})
