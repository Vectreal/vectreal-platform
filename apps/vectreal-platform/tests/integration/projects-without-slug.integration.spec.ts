/**
 * Projects the app creates without a slug, against real tables. The slug is
 * unread and on its way out, so the app never writes one: a project is
 * created, defaulted and listed on id and name alone. The database still
 * fills a unique value, because the release before this one reads the slug as
 * a required string and keeps serving through a deploy.
 *
 * `listOrganizationProjects` is also what `GET /api/v1/projects` answers: one
 * organization's projects and nothing from another, by name.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type ProjectRepository =
	typeof import('../../app/lib/domain/project/project-repository.server')
type UserRepository =
	typeof import('../../app/lib/domain/user/user-repository.server')

/** What the old release's slug rule accepts: lowercase, hyphens, under 50. */
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

describe('projects the app creates without a slug', () => {
	let schema: Schema
	let db: Db
	let projectRepository: ProjectRepository
	let userRepository: UserRepository

	const ownerId = randomUUID()
	const orgId = randomUUID()
	const otherOrgId = randomUUID()
	const emptyOrgId = randomUUID()
	const defaultOrgId = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		projectRepository =
			await import('../../app/lib/domain/project/project-repository.server')
		userRepository =
			await import('../../app/lib/domain/user/user-repository.server')

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@projects.test`,
			name: 'Owner'
		})
		await db.insert(schema.organizations).values([
			{ id: orgId, name: `list-${orgId}`, ownerId },
			{ id: otherOrgId, name: `list-${otherOrgId}`, ownerId },
			{ id: emptyOrgId, name: `list-${emptyOrgId}`, ownerId },
			{ id: defaultOrgId, name: `list-${defaultOrgId}`, ownerId }
		])
		await db.insert(schema.organizationMemberships).values([
			{ userId: ownerId, organizationId: emptyOrgId, role: 'owner' },
			{ userId: ownerId, organizationId: defaultOrgId, role: 'owner' }
		])
		await db.insert(schema.projects).values([
			{
				organizationId: orgId,
				name: 'Tables',
				allowedEmbedDomains: 'shop.example'
			},
			{ organizationId: orgId, name: 'Chairs' },
			{ organizationId: otherOrgId, name: 'Lamps' }
		])
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(
				inArray(schema.organizations.id, [
					orgId,
					otherOrgId,
					emptyOrgId,
					defaultOrgId
				])
			)
		await db.delete(schema.users).where(inArray(schema.users.id, [ownerId]))
	})

	it("lists one organization's projects by name, with only id and name", async () => {
		const listed = await projectRepository.listOrganizationProjects(orgId)

		expect(listed).toEqual([
			{ id: expect.any(String), name: 'Chairs' },
			{ id: expect.any(String), name: 'Tables' }
		])
	})

	it('gives every project the app inserts a distinct database slug', async () => {
		const rows = await db
			.select({ slug: schema.projects.slug })
			.from(schema.projects)
			.where(inArray(schema.projects.organizationId, [orgId, otherOrgId]))

		expect(rows).toHaveLength(3)
		expect(new Set(rows.map((row) => row.slug)).size).toBe(3)
		for (const { slug } of rows) expect(slug).toMatch(UUID)
	})

	it('lists nothing for an organization without projects', async () => {
		await expect(
			projectRepository.listOrganizationProjects(randomUUID())
		).resolves.toEqual([])
	})

	it('creates a project from a name alone', async () => {
		const created = await projectRepository.createProject(
			emptyOrgId,
			'Benches',
			ownerId
		)

		expect(created).toMatchObject({
			organizationId: emptyOrgId,
			name: 'Benches'
		})
		expect(created.slug).toMatch(UUID)
	})

	it('creates the default project without a slug', async () => {
		const project = await userRepository.getOrCreateDefaultProject(
			ownerId,
			defaultOrgId
		)

		expect(project.name).toBe('My Project')
		expect(project.slug).toMatch(UUID)
		const [row] = await db
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.organizationId, defaultOrgId))
		expect(row?.id).toBe(project.id)
	})
})
