/**
 * Round-trips hotspots through a real Postgres.
 *
 * This cannot be unit tested. The defect it exists to prevent was a client
 * that minted `hotspot-<timestamp>-<random>` into a `uuid` primary key: types
 * were satisfied on both sides, and the failure only appeared when Postgres
 * refused the cast. Because `replaceHotspots` shares a transaction with the
 * settings and asset writes, that refusal failed the entire scene save.
 *
 * `occlusion_enabled` is here for the same reason. It existed on the
 * TypeScript type with no column behind it, so it type-checked everywhere and
 * silently vanished on write.
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
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { HotspotDefinition } from '@vctrl/core'

type Schema = typeof import('../../app/db/schema')
type Repository =
	typeof import('../../app/lib/domain/scene/server/scene-settings-repository.server')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('hotspot persistence', () => {
	let schema: Schema
	let getHotspotsBySceneSettingsId: Repository['getHotspotsBySceneSettingsId']
	let replaceHotspots: Repository['replaceHotspots']
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const sceneId = randomUUID()
	let sceneSettingsId: string

	const hotspot = (
		overrides: Partial<HotspotDefinition> = {}
	): HotspotDefinition => ({
		id: randomUUID(),
		name: 'Handle',
		worldPosition: [1, 2, 3],
		visible: true,
		internalOnly: false,
		stylePreset: 'dot',
		occlusionEnabled: true,
		...overrides
	})

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ getHotspotsBySceneSettingsId, replaceHotspots } =
			await import('../../app/lib/domain/scene/server/scene-settings-repository.server'))
		db = (await import('../../app/db/client')).getDbClient()

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
		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId,
			folderId: null,
			name: 'hotspot smoke'
		})
		const [settings] = await db
			.insert(schema.sceneSettings)
			.values({ sceneId, createdBy: ownerId })
			.returning({ id: schema.sceneSettings.id })
		sceneSettingsId = settings.id
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('stores and reads back a hotspot whole', async () => {
		const written = hotspot({
			name: 'Lid',
			worldPosition: [1.5, -2.25, 0],
			sequenceIndex: 0,
			stylePreset: 'svg',
			payloadUrl: 'https://example.test/marker.svg',
			occlusionEnabled: false,
			internalOnly: true,
			visible: false
		})

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [written])
		)

		const [read] = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(read).toEqual(written)
	})

	// The whole reason this file exists.
	it('refuses the legacy non-uuid id, rather than storing it', async () => {
		const legacy = hotspot({ id: 'hotspot-1755000000000-a1b2c3' })

		await expect(
			db.transaction((tx) => replaceHotspots(tx, sceneSettingsId, [legacy]))
		).rejects.toThrow()
	})

	it('defaults occlusion to enabled when the client omits it', async () => {
		const written = hotspot({ occlusionEnabled: undefined })

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [written])
		)

		const [read] = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(read.occlusionEnabled).toBe(true)
	})

	it('replaces the whole set, so a removal is a removal', async () => {
		const first = hotspot({ name: 'First' })
		const second = hotspot({ name: 'Second' })

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [first, second])
		)
		await db.transaction((tx) => replaceHotspots(tx, sceneSettingsId, [first]))

		const rows = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(rows.map((h) => h.name)).toEqual(['First'])
	})

	it('clears the set when the last hotspot is deleted', async () => {
		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [hotspot()])
		)
		await db.transaction((tx) => replaceHotspots(tx, sceneSettingsId, []))

		const rows = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(rows).toEqual([])
	})

	it('returns a sequence in the order it will be played', async () => {
		const third = hotspot({ name: 'Third', sequenceIndex: 2 })
		const first = hotspot({ name: 'First', sequenceIndex: 0 })
		const second = hotspot({ name: 'Second', sequenceIndex: 1 })

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [third, first, second])
		)

		const rows = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(rows.map((h) => h.name)).toEqual(['First', 'Second', 'Third'])
	})
})
