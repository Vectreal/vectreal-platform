/**
 * A marker may keep a linked image saved before uploads, and nothing more.
 *
 * The rule compares against the stored row, so it only exists inside the save
 * transaction: a static parse cannot know which address a marker already had.
 * Driven through the real save operation, so the refusal is also seen to come
 * back as a 400 naming the marker rather than as a server error.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 *
 * Every row it creates is namespaced by a fresh uuid and dropped in `afterAll`.
 */

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest'

import type { HotspotDefinition } from '@vctrl/core'

// The rejected path reclaims the request's uploads; there are none, but the
// storage client is still constructed.
vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { name: 'assets' }, error: null }),
			createBucket: async () => ({ data: null, error: null }),
			from: () => ({
				remove: async () => ({ data: null, error: null })
			})
		}
	})
}))

const { reportServerError } = vi.hoisted(() => ({ reportServerError: vi.fn() }))

// A refused save is the author's to fix, not a server fault to page anyone on.
vi.mock('../../app/lib/observability/report-server-error.server', () => ({
	reportServerError
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Operations =
	typeof import('../../app/lib/domain/scene/server/scene-settings.operations.server')

const LEGACY_URL = 'https://cdn.test/legacy-pin.png'

describe('linked marker artwork on save', () => {
	let schema: Schema
	let db: Db
	let saveSceneSettings: Operations['saveSceneSettings']

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const sceneId = randomUUID()
	const hotspotId = randomUUID()
	const assetFolderId = randomUUID()
	// A save links at least one asset, so the scene carries a model.
	const modelAssetId = randomUUID()

	const marker = (payloadUrl?: string, id = hotspotId): HotspotDefinition => ({
		id,
		name: 'Rear badge',
		worldPosition: [1, 2, 3],
		visible: true,
		internalOnly: false,
		stylePreset: 'image',
		payloadUrl
	})

	const save = (hotspots: HotspotDefinition[]) =>
		saveSceneSettings(
			{
				action: 'commit-scene-save',
				requestId: randomUUID(),
				sceneId,
				projectId,
				meta: { name: 'Chair' },
				settings: { hotspots },
				sceneAssetIds: [modelAssetId]
			} as never,
			ownerId
		)

	const storedPayload = async () => {
		const [row] = await db
			.select({ payloadUrl: schema.sceneHotspots.payloadUrl })
			.from(schema.sceneHotspots)
			.where(eq(schema.sceneHotspots.id, hotspotId))
		return row?.payloadUrl ?? null
	}

	beforeAll(async () => {
		process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321'
		process.env.SUPABASE_SECRET_KEY ??= 'integration-test-key'

		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ saveSceneSettings } =
			await import('../../app/lib/domain/scene/server/scene-settings.operations.server'))

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
		await db.insert(schema.assets).values({
			id: modelAssetId,
			folderId: assetFolderId,
			name: 'chair.glb',
			type: 'model',
			filePath: `smoke/${modelAssetId}/chair.glb`,
			fileSize: 1024,
			mimeType: 'model/gltf-binary',
			ownerId
		})
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: 'Chair' })

		const first = await save([marker()])
		expect(first.ok, await first.clone().text()).toBe(true)
	})

	// A marker as one saved before uploads existed: given the linked address
	// only an older release could store. Every case starts from it.
	beforeEach(async () => {
		reportServerError.mockClear()
		await db
			.update(schema.sceneHotspots)
			.set({ payloadUrl: LEGACY_URL })
			.where(eq(schema.sceneHotspots.id, hotspotId))
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('keeps saving a linked image the marker already had', async () => {
		const response = await save([marker(LEGACY_URL)])

		expect(response.status).toBe(200)
		expect(await storedPayload()).toBe(LEGACY_URL)
	})

	it.each([
		['an edited address', () => [marker('https://cdn.test/other.png')]],
		[
			'a new marker',
			() => [marker(LEGACY_URL), marker(LEGACY_URL, randomUUID())]
		]
	])('refuses %s with a 400 naming the marker', async (_label, hotspots) => {
		const response = await save(hotspots())

		expect(response.status).toBe(400)
		const body = (await response.json()) as { error: string }
		expect(body.error).toContain('Marker "Rear badge"')
		expect(reportServerError).not.toHaveBeenCalled()
		// The transaction rolled back, so the stored address is untouched.
		expect(await storedPayload()).toBe(LEGACY_URL)
	})

	it('accepts an inline image in its place', async () => {
		const inline = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E'

		const response = await save([marker(inline)])

		expect(response.status).toBe(200)
		expect(await storedPayload()).toBe(inline)
	})
})
