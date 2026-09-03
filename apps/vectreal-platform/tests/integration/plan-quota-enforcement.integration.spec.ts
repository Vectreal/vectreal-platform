/**
 * Proves the plan limits refuse at the boundary, against a real Postgres.
 *
 * These guards all used to call `checkQuota`, which reads `org_usage_counters`.
 * Nothing in the app ever called `incrementUsage`, so every counter sat at zero
 * and none of them could fire: a free organization created its second project
 * by resubmitting the ordinary form. A unit test cannot catch that, because the
 * defect is the query the guard runs, not the arithmetic it does afterwards.
 *
 * So every assertion here goes through the real repository function and lets it
 * hit the database. Each limit is squeezed with an `org_limit_overrides` row
 * rather than by creating hundreds of rows, which is the technique
 * `dashboard-folder-sql.integration.spec.ts` already uses for `folders_total`.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a run id and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type ProjectRepo =
	typeof import('../../app/lib/domain/project/project-repository.server')
type ApiKeyRepo =
	typeof import('../../app/lib/domain/auth/api-key-repository.server')
type OrgRepo =
	typeof import('../../app/lib/domain/organization/organization-repository.server')
type SceneOps =
	typeof import('../../app/lib/domain/scene/server/scene-settings.operations.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('plan limits refuse at the boundary', () => {
	// Imported in `beforeAll`: each of these calls `getDbClient()` at module
	// scope, which throws without a `DATABASE_URL`.
	let schema: Schema
	let projectRepo: ProjectRepo
	let apiKeyRepo: ApiKeyRepo
	let orgRepo: OrgRepo
	let sceneOps: SceneOps
	let db: Db

	const ownerId = randomUUID()
	const inviteeId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const folderId = randomUUID()

	/*
	  A second tenant that no test touches. Every count in the guards filters by
	  organization, and with only one organization in the fixture an unfiltered
	  count returns the same number - so dropping the filter would enforce one
	  tenant's usage against another's limit and no assertion would notice. These
	  rows exist so that mistake changes a number.
	*/
	const decoyOwnerId = randomUUID()
	const decoyOrganizationId = randomUUID()
	const decoyProjectId = randomUUID()

	/** Squeezes one limit for this org. Enterprise-style `null` means no cap. */
	const setLimit = async (limitKey: string, value: number) => {
		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, organizationId))
		await db.insert(schema.orgLimitOverrides).values({
			organizationId,
			limitKey,
			limitValue: BigInt(value)
		})
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		projectRepo =
			await import('../../app/lib/domain/project/project-repository.server')
		apiKeyRepo =
			await import('../../app/lib/domain/auth/api-key-repository.server')
		orgRepo =
			await import('../../app/lib/domain/organization/organization-repository.server')
		sceneOps =
			await import('../../app/lib/domain/scene/server/scene-settings.operations.server')
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.users).values([
			{ id: ownerId, email: `owner-${ownerId}@quota.test`, name: 'Owner' },
			{
				id: inviteeId,
				email: `invitee-${inviteeId}@quota.test`,
				name: 'Guest'
			},
			{
				id: decoyOwnerId,
				email: `decoy-${decoyOwnerId}@quota.test`,
				name: 'Decoy'
			}
		])

		/*
		  Named exactly 'My Organization' because `prepareSceneUpload` resolves the
		  acting org through `getOrCreateDefaultOrganization`, which matches on that
		  literal name plus an owner membership. Any other name and the scene tests
		  would create a second org and measure the wrong one - which fails loudly
		  rather than quietly, since the new org holds no scenes and the refusal
		  assertions would stop seeing a refusal.
		*/
		await db.insert(schema.organizations).values({
			id: organizationId,
			name: 'My Organization',
			ownerId
		})
		await db
			.insert(schema.organizationMemberships)
			.values({ userId: ownerId, organizationId, role: 'owner' })

		// The decoy tenant, described above. Nothing in any test touches it.
		await db.insert(schema.organizations).values({
			id: decoyOrganizationId,
			name: `decoy-${decoyOrganizationId}`,
			ownerId: decoyOwnerId
		})
		await db.insert(schema.organizationMemberships).values([
			{
				userId: decoyOwnerId,
				organizationId: decoyOrganizationId,
				role: 'owner'
			},
			{
				userId: inviteeId,
				organizationId: decoyOrganizationId,
				role: 'member'
			}
		])
		await db.insert(schema.projects).values({
			id: decoyProjectId,
			organizationId: decoyOrganizationId,
			name: 'Decoy project',
			slug: `decoy-${decoyProjectId}`
		})
		await db.insert(schema.scenes).values({
			id: randomUUID(),
			projectId: decoyProjectId,
			folderId: null,
			name: 'decoy scene'
		})
		await apiKeyRepo.createApiKey({
			userId: decoyOwnerId,
			organizationId: decoyOrganizationId,
			name: 'decoy key',
			projectIds: [decoyProjectId]
		})
	})

	/*
	  Each test starts from the same baseline: one project, no scenes, no assets,
	  no keys, no overrides. Without this the API key tests inherited the live key
	  the previous one minted and started already at their limit, which reads as
	  the guard misfiring rather than as leaked state.
	*/
	beforeEach(async () => {
		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, organizationId))
		await db
			.delete(schema.apiKeys)
			.where(eq(schema.apiKeys.organizationId, organizationId))
		await db.delete(schema.assets).where(eq(schema.assets.folderId, folderId))
		await db.delete(schema.scenes).where(eq(schema.scenes.projectId, projectId))
		await db
			.delete(schema.organizationMemberships)
			.where(
				and(
					eq(schema.organizationMemberships.organizationId, organizationId),
					eq(schema.organizationMemberships.userId, inviteeId)
				)
			)
		await db
			.delete(schema.projects)
			.where(eq(schema.projects.organizationId, organizationId))
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Quota project',
			slug: `quota-${projectId}`
		})
		await db
			.insert(schema.folders)
			.values({ id: folderId, projectId, name: 'Quota folder' })
	})

	afterAll(async () => {
		if (!db) return

		await db
			.delete(schema.orgLimitOverrides)
			.where(eq(schema.orgLimitOverrides.organizationId, organizationId))
		await db
			.delete(schema.apiKeys)
			.where(eq(schema.apiKeys.organizationId, organizationId))
		await db.delete(schema.assets).where(eq(schema.assets.folderId, folderId))
		await db
			.delete(schema.folders)
			.where(eq(schema.folders.projectId, projectId))
		await db.delete(schema.scenes).where(eq(schema.scenes.projectId, projectId))
		await db
			.delete(schema.projects)
			.where(eq(schema.projects.organizationId, organizationId))
		await db
			.delete(schema.organizationMemberships)
			.where(eq(schema.organizationMemberships.organizationId, organizationId))
		await db
			.delete(schema.organizations)
			.where(
				inArray(schema.organizations.id, [organizationId, decoyOrganizationId])
			)
		await db
			.delete(schema.users)
			.where(inArray(schema.users.id, [ownerId, inviteeId, decoyOwnerId]))
	})

	/*
	  Counts used by the "and nothing was written" half of each refusal. None of
	  these guards shares a transaction with the insert it protects, so moving a
	  guard below its insert would commit the row *and* throw - and an assertion
	  that only checks the message stays green through it. For API keys that is
	  live damage: the row is written active, with a decryptable value, so the
	  embed panel would later hand out a key the caller was told it could not
	  have.
	*/
	const countProjects = async () => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.projects)
			.where(eq(schema.projects.organizationId, organizationId))
		return row?.total ?? 0
	}
	const countLiveKeys = async () => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.apiKeys)
			.where(
				and(
					eq(schema.apiKeys.organizationId, organizationId),
					isNull(schema.apiKeys.revokedAt)
				)
			)
		return row?.total ?? 0
	}
	const countMembers = async () => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.organizationMemberships)
			.where(eq(schema.organizationMemberships.organizationId, organizationId))
		return row?.total ?? 0
	}
	const countScenes = async () => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.scenes)
			.where(eq(schema.scenes.projectId, projectId))
		return row?.total ?? 0
	}

	/*
	  The free baseline is already 1 project, so this refusal needs no override -
	  and deliberately uses none. An override of 1 here would be decorative: it
	  matches the default, so the test would pass even if override resolution
	  were broken entirely. The allow test below is where the override earns its
	  keep, by raising the limit above the default.
	*/
	it('refuses a project at the free plan default, and writes nothing', async () => {
		await expect(
			projectRepo.createProject(
				organizationId,
				'over quota',
				`over-${randomUUID()}`,
				ownerId
			)
		).rejects.toThrow(/you can have one project/)

		expect(await countProjects()).toBe(1)
	})

	it('allows a project when an override raises the limit', async () => {
		await setLimit('projects_total', 2)

		const created = await projectRepo.createProject(
			organizationId,
			'within quota',
			`within-${randomUUID()}`,
			ownerId
		)
		expect(created.id).toBeTruthy()
		expect(await countProjects()).toBe(2)
	})

	it('refuses an API key once api_keys_per_org is used up, and writes nothing', async () => {
		await setLimit('api_keys_per_org', 1)

		const first = await apiKeyRepo.createApiKey({
			userId: ownerId,
			organizationId,
			name: 'first',
			projectIds: [projectId]
		})
		expect(first.plaintext).toBeTruthy()

		await expect(
			apiKeyRepo.createApiKey({
				userId: ownerId,
				organizationId,
				name: 'second',
				projectIds: [projectId]
			})
		).rejects.toThrow(/API key limit reached/)

		expect(await countLiveKeys()).toBe(1)
	})

	it('counts only live keys, so revoking one frees a slot', async () => {
		/*
		  The count filters on `revoked_at is null`. Counting every row would leave
		  an organization permanently stuck at its limit after a rotation, which is
		  the opposite of what revoking is for.
		*/
		await setLimit('api_keys_per_org', 1)

		const first = await apiKeyRepo.createApiKey({
			userId: ownerId,
			organizationId,
			name: 'to be revoked',
			projectIds: [projectId]
		})
		await apiKeyRepo.revokeApiKey(first.apiKey.id, ownerId)

		const second = await apiKeyRepo.createApiKey({
			userId: ownerId,
			organizationId,
			name: 'replacement',
			projectIds: [projectId]
		})
		expect(second.plaintext).toBeTruthy()
		expect(await countLiveKeys()).toBe(1)
	})

	// Free is one seat and the owner holds it, so no override is needed here
	// either. See the note on the project refusal above.
	it('refuses an invite at the free plan default, and writes nothing', async () => {
		await expect(
			orgRepo.inviteOrganizationMember(
				organizationId,
				ownerId,
				inviteeId,
				'member'
			)
		).rejects.toThrow(/Seat limit reached/)

		expect(await countMembers()).toBe(1)
	})

	it('allows an invite when an override raises the seat limit', async () => {
		/*
		  Without this, dropping the organization filter from the seat count would
		  over-count, still refuse, and stay green - while locking every
		  business-plan organization out of inviting anyone.
		*/
		await setLimit('org_seats', 2)

		const membership = await orgRepo.inviteOrganizationMember(
			organizationId,
			ownerId,
			inviteeId,
			'member'
		)
		expect(membership.userId).toBe(inviteeId)
		expect(await countMembers()).toBe(2)
	})

	it('refuses a new scene once scenes_total is used up, and writes nothing', async () => {
		await db
			.insert(schema.scenes)
			.values({ id: randomUUID(), projectId, folderId: null, name: 'existing' })
		await setLimit('scenes_total', 1)

		await expect(
			sceneOps.prepareSceneUpload(
				{ action: 'prepare-scene-upload', requestId: randomUUID() },
				ownerId
			)
		).rejects.toThrow(/Scene limit reached/)

		expect(await countScenes()).toBe(1)
	})

	it('allows a new scene when an override raises the limit', async () => {
		await db
			.insert(schema.scenes)
			.values({ id: randomUUID(), projectId, folderId: null, name: 'existing' })
		await setLimit('scenes_total', 2)

		const prepared = await sceneOps.prepareSceneUpload(
			{ action: 'prepare-scene-upload', requestId: randomUUID() },
			ownerId
		)
		expect(prepared.sceneId).toBeTruthy()
	})
})
