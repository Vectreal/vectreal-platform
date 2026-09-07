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

import { QuotaExceededError } from '../../app/lib/domain/billing/quota-exceeded-error'

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

	/*
	  `scenes_published_concurrent` is the odd one out in this file. It already
	  counted rows before the migration off `checkQuota`, and it had no coverage
	  anywhere - so nothing recorded that its refusal never reached the client.
	  `publishScene` caught its own `QuotaExceededError` and returned
	  `ApiResponse.serverError`: a 500 carrying the message and none of the
	  machine-readable half, so no limit, no plan, no upgrade target, no modal.

	  Hence `rejects` rather than an assertion about a returned `Response`, and
	  `rejects` specifically rather than settling both paths into one value. The
	  route's catch is what turns this into a quota response and it can only do
	  that for an error that leaves the operation, so a test that accepts a
	  *returned* `QuotaExceededError` would pass while the client stayed broken.
	*/

	/**
	 * The GLB every published row in these tests points at. Created per test
	 * rather than in `beforeEach`, so the tests above keep the fixture they were
	 * written against.
	 */
	const makePublishedAsset = async () => {
		const assetId = randomUUID()
		await db.insert(schema.assets).values({
			id: assetId,
			folderId,
			name: 'published.glb',
			type: 'model',
			filePath: `quota/${assetId}/published.glb`,
			ownerId
		})
		return assetId
	}

	/** `howMany` already-published scenes, all pointing at the one asset. */
	const publishScenes = async (
		howMany: number,
		assetId: string,
		intoProject = projectId
	) => {
		for (let i = 0; i < howMany; i += 1) {
			const publishedSceneId = randomUUID()
			await db.insert(schema.scenes).values({
				id: publishedSceneId,
				projectId: intoProject,
				folderId: null,
				name: `published ${i}`
			})
			await db.insert(schema.scenePublished).values({
				sceneId: publishedSceneId,
				assetId,
				publishedBy: ownerId
			})
		}
	}

	/** The scene a test then tries to publish, plus the asset it would publish. */
	const sceneAwaitingPublish = async (intoProject = projectId) => {
		const sceneId = randomUUID()
		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId: intoProject,
			folderId: null,
			name: 'wants publishing'
		})
		return sceneId
	}

	const attemptPublish = (sceneId: string, assetId: string) =>
		sceneOps.publishScene(
			{
				action: 'commit-scene-publish',
				requestId: randomUUID(),
				sceneId,
				publishedAssetId: assetId
			},
			ownerId
		)

	const countPublishedInProject = async (scopeProjectId = projectId) => {
		const [row] = await db
			.select({ total: count() })
			.from(schema.scenePublished)
			.innerJoin(
				schema.scenes,
				eq(schema.scenes.id, schema.scenePublished.sceneId)
			)
			.where(eq(schema.scenes.projectId, scopeProjectId))
		return row?.total ?? 0
	}

	/*
	  The free baseline is 3, so this refusal needs no override and deliberately
	  uses none - an override of 3 would match the default and pass even if
	  override resolution were broken. The allow test below is where the override
	  earns its keep, by raising the limit above the default.
	*/
	it('refuses a publish at the free plan default, and publishes nothing', async () => {
		const assetId = await makePublishedAsset()
		await publishScenes(3, assetId)
		const sceneId = await sceneAwaitingPublish()

		const attempt = attemptPublish(sceneId, assetId)
		await expect(attempt).rejects.toBeInstanceOf(QuotaExceededError)
		/*
		  The whole payload the upgrade modal is built from. `upgradeTo` is the
		  one the modal renders its call to action from, so an error carrying
		  `null` there is a modal with no way out of it.
		*/
		await expect(attempt).rejects.toMatchObject({
			limitKey: 'scenes_published_concurrent',
			currentValue: 3,
			limit: 3,
			plan: 'free',
			upgradeTo: 'pro'
		})

		expect(await countPublishedInProject()).toBe(3)
	})

	it('allows a publish when an override raises the concurrent limit', async () => {
		const assetId = await makePublishedAsset()
		await publishScenes(3, assetId)
		const sceneId = await sceneAwaitingPublish()
		await setLimit('scenes_published_concurrent', 4)

		const response = await attemptPublish(sceneId, assetId)

		expect(response.status).toBe(200)
		expect(await countPublishedInProject()).toBe(4)
	})

	/*
	  Free is the only plan that scopes this count to the project rather than the
	  organization, and one project cannot tell the two apart. So the second
	  project holds published scenes of its own, chosen to straddle the limit:
	  two per project is under the free cap of 3, while the organization total of
	  four is over it. Flipping `useProjectScopedLimit` to false fails this test
	  and nothing else.

	  Inserted directly rather than through `createProject`, which would refuse
	  on `projects_total` long before this limit came into it.
	*/
	it('counts published scenes per project on free, not per organization', async () => {
		const siblingProjectId = randomUUID()
		await db.insert(schema.projects).values({
			id: siblingProjectId,
			organizationId,
			name: 'Sibling project',
			slug: `sibling-${siblingProjectId}`
		})

		const assetId = await makePublishedAsset()
		await publishScenes(2, assetId)
		await publishScenes(2, assetId, siblingProjectId)
		const sceneId = await sceneAwaitingPublish()

		const response = await attemptPublish(sceneId, assetId)

		expect(response.status).toBe(200)
		expect(await countPublishedInProject()).toBe(3)
		expect(await countPublishedInProject(siblingProjectId)).toBe(2)
	})
})
