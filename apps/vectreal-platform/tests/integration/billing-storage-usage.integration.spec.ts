/**
 * Asks a real Postgres what an organization is actually storing.
 *
 * Both defects here are shapes of a join, so they only appear against a real
 * planner. Measuring through `scene_assets` could not see an asset no scene
 * links - a published GLB lives in `scene_published`, an abandoned upload lives
 * in neither - and it summed over join rows, so an asset shared by two scenes
 * was billed twice. Uploads are content-addressed and deduplicated per project,
 * so that sharing is the normal case rather than an edge one.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Loader =
	typeof import('../../app/lib/domain/billing/billing-dashboard-loader.server')

describe('organization storage usage', () => {
	let schema: Schema
	let db: Db
	let loadOrgUsage: Loader['loadOrgUsage']

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()

	// A second organization owned by the same user. Without it the query would
	// measure identically with or without its `organizationId` predicate on any
	// database that happens to hold no other assets.
	const otherOrganizationId = randomUUID()
	const otherProjectId = randomUUID()
	const otherFolderId = randomUUID()
	const OTHER_ORG_BYTES = 999_999

	const SHARED_BYTES = 1000
	const PUBLISHED_BYTES = 200
	const ORPHAN_BYTES = 30

	const sceneIds: string[] = []

	const addAsset = async (
		name: string,
		fileSize: number,
		folderId: string = assetFolderId
	) => {
		const assetId = randomUUID()
		await db.insert(schema.assets).values({
			id: assetId,
			folderId,
			name,
			type: 'model',
			filePath: `scenes/${randomUUID()}/assets/${assetId}/${name}`,
			fileSize,
			ownerId
		})
		return assetId
	}

	const addScene = async (name: string) => {
		const sceneId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name })
		const settingsId = randomUUID()
		await db
			.insert(schema.sceneSettings)
			.values({ id: settingsId, sceneId, createdBy: ownerId })
		sceneIds.push(sceneId)
		return { sceneId, settingsId }
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ loadOrgUsage } =
			await import('../../app/lib/domain/billing/billing-dashboard-loader.server'))

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@smoke.test`,
			name: 'Owner'
		})
		await db
			.insert(schema.organizations)
			.values({ id: organizationId, name: `smoke-${organizationId}`, ownerId })
		await db.insert(schema.organizationMemberships).values({
			userId: ownerId,
			organizationId,
			role: 'owner'
		})
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Smoke project',
			slug: `smoke-${projectId}`
		})
		await db
			.insert(schema.folders)
			.values({ id: assetFolderId, projectId, name: 'Scene Assets' })

		// One deduplicated asset linked by two scenes. Stored once, so billed once.
		const shared = await addAsset('shared.bin', SHARED_BYTES)
		const first = await addScene('first')
		const second = await addScene('second')
		await db.insert(schema.sceneAssets).values([
			{ sceneSettingsId: first.settingsId, assetId: shared },
			{ sceneSettingsId: second.settingsId, assetId: shared }
		])

		// A published GLB, which no `scene_assets` row ever points at.
		const publishedAsset = await addAsset('published.glb', PUBLISHED_BYTES)
		await db.insert(schema.scenePublished).values({
			sceneId: first.sceneId,
			assetId: publishedAsset,
			publishedBy: ownerId
		})

		// An upload no commit ever linked. It occupies the bucket regardless.
		await addAsset('abandoned.bin', ORPHAN_BYTES)

		// Belongs to a different organization, so it must not appear in the total.
		await db.insert(schema.organizations).values({
			id: otherOrganizationId,
			name: `other-${otherOrganizationId}`,
			ownerId
		})
		await db.insert(schema.organizationMemberships).values({
			userId: ownerId,
			organizationId: otherOrganizationId,
			role: 'owner'
		})
		await db.insert(schema.projects).values({
			id: otherProjectId,
			organizationId: otherOrganizationId,
			name: 'Other project',
			slug: `other-${otherProjectId}`
		})
		await db.insert(schema.folders).values({
			id: otherFolderId,
			projectId: otherProjectId,
			name: 'Scene Assets'
		})
		await addAsset('elsewhere.bin', OTHER_ORG_BYTES, otherFolderId)

		/*
		  And a scene, so the scene count has something to leak. Without this the
		  other organization holds only assets, and dropping the organization
		  filter from the scene count changes no number - the test would pass
		  against the defect it exists to catch.
		*/
		const otherSceneId = randomUUID()
		await db.insert(schema.scenes).values({
			id: otherSceneId,
			projectId: otherProjectId,
			folderId: null,
			name: 'other org scene'
		})
		/*
		  Published too, so the published count is pinned directly rather than
		  only through the scene count it used to be derived from.
		*/
		await db.insert(schema.scenePublished).values({
			sceneId: otherSceneId,
			assetId: await addAsset('other-published.glb', 1, otherFolderId),
			publishedBy: ownerId
		})
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, otherOrganizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('counts every stored byte once', async () => {
		const usage = await loadOrgUsage(organizationId)

		// The other organization's asset is deliberately far larger than the
		// total, so leaking it in cannot be mistaken for a rounding difference.
		expect(usage.storageBytesTotal).toBe(
			SHARED_BYTES + PUBLISHED_BYTES + ORPHAN_BYTES
		)
	})

	it('counts scenes and projects for this organization alone', async () => {
		/*
		  These two used to be handed in by the caller, from `getUserProjects`,
		  which joins memberships on the user and so spans every organization they
		  belong to - while the limits beside them, and the guards enforcing those
		  limits, count one. A member of two organizations saw the sum of both
		  measured against one organization's allowance, in red, while creation
		  went on working.

		  The fixture's owner is a member of both organizations, so a regression
		  to the caller-supplied counts shows up here as inflated numbers.
		*/
		const usage = await loadOrgUsage(organizationId)

		expect(usage.scenesTotal).toBe(sceneIds.length)
		expect(usage.projectsTotal).toBe(1)
		expect(usage.publishedScenes).toBe(1)
	})
})
