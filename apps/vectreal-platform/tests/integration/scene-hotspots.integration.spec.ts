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

	// Forces where a hotspot lands under the `id` tiebreaker, without giving up
	// the per-run uniqueness the rest of the ids have.
	const uuidStartingWith = (hexDigit: string) =>
		`${hexDigit}${randomUUID().slice(1)}`

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

	/**
	 * The property this whole suite exists for, and the one it used to assert
	 * only in prose. `replaceHotspots` shares its transaction with the settings
	 * and asset writes, so a hotspot Postgres refuses has to take the rest of
	 * the save down with it. Without that, a scene saves its camera and
	 * environment, drops its hotspots, and reports success.
	 */
	it('rolls a settings write back when a hotspot in the same transaction fails', async () => {
		const readEnvironment = async () => {
			const [row] = await db
				.select({ environment: schema.sceneSettings.environment })
				.from(schema.sceneSettings)
				.where(eq(schema.sceneSettings.id, sceneSettingsId))
			return row?.environment ?? null
		}

		const before = await readEnvironment()

		await expect(
			db.transaction(async (tx) => {
				await tx
					.update(schema.sceneSettings)
					.set({ environment: { preset: 'studio-key' } })
					.where(eq(schema.sceneSettings.id, sceneSettingsId))

				// Exactly the id shape the client used to mint into a uuid column.
				await replaceHotspots(tx, sceneSettingsId, [
					hotspot({ id: 'hotspot-1755123456789-abc' })
				])
			})
		).rejects.toThrow()

		expect(await readEnvironment()).toEqual(before)
		expect(
			await db.transaction((tx) =>
				getHotspotsBySceneSettingsId(tx, sceneSettingsId)
			)
		).toEqual([])
	})

	it('stores and reads back a hotspot whole', async () => {
		const written = hotspot({
			name: 'Lid',
			worldPosition: [1.5, -2.25, 0],
			sequenceIndex: 0,
			stylePreset: 'svg',
			payloadUrl: 'https://example.test/marker.svg',
			body: 'Cast in one piece, then machined flat.',
			linkUrl: 'https://example.test/spec',
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

	/**
	 * The update half of the upsert, which the insert-only test above cannot
	 * reach. A surviving hotspot is updated in place rather than deleted and
	 * reinserted, so every column has to be named twice: once in `values` and
	 * again in `onConflictDoUpdate.set`. A column missing from the second list
	 * writes correctly on the save that creates the hotspot and silently
	 * no-ops on every save after it, which reads to an author as an edit that
	 * will not stick.
	 */
	it('updates a hotspot\u2019s content in place on a second save', async () => {
		const id = randomUUID()

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [
				hotspot({ id, body: 'First draft.', linkUrl: 'https://a.test/one' })
			])
		)
		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [
				hotspot({ id, body: 'Second draft.', linkUrl: 'https://a.test/two' })
			])
		)

		const [read] = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(read.body).toBe('Second draft.')
		expect(read.linkUrl).toBe('https://a.test/two')
	})

	it('clears a hotspot\u2019s content when the author empties both fields', async () => {
		const id = randomUUID()

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [
				hotspot({ id, body: 'Said something.', linkUrl: 'https://a.test/one' })
			])
		)
		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [hotspot({ id })])
		)

		const [read] = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(read.body).toBeUndefined()
		expect(read.linkUrl).toBeUndefined()
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

	// Resaving used to delete and reinsert every row, which stamped the surviving
	// hotspot with the timestamp of whichever save it last went through.
	it('keeps a resaved hotspot ahead of one authored later', async () => {
		// Only a surviving `createdAt` can order these this way round: on id
		// alone, 'Later' would come first.
		const original = hotspot({ id: uuidStartingWith('f'), name: 'Original' })
		const later = hotspot({ id: uuidStartingWith('0'), name: 'Later' })

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [original])
		)
		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [original])
		)
		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [later, original])
		)

		const rows = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(rows.map((h) => h.name)).toEqual(['Original', 'Later'])
	})

	// Two hotspots authored in one write share a `createdAt`, so only `id` can
	// stop the list reshuffling itself between reads.
	it('breaks a same-write tie on id rather than on insertion order', async () => {
		const higher = hotspot({ id: uuidStartingWith('f'), name: 'Higher id' })
		const lower = hotspot({ id: uuidStartingWith('0'), name: 'Lower id' })

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [higher, lower])
		)

		const rows = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)

		expect(rows.map((h) => h.name)).toEqual(['Lower id', 'Higher id'])
	})

	// The primary key is global, so a draft restored twice and saved as two
	// scenes can carry the same hotspot id into both.
	it('refuses to take over a hotspot id owned by another scene', async () => {
		const contestedId = randomUUID()
		const otherSceneId = randomUUID()

		await db.insert(schema.scenes).values({
			id: otherSceneId,
			projectId,
			folderId: null,
			name: 'hotspot smoke rival'
		})
		const [otherSettings] = await db
			.insert(schema.sceneSettings)
			.values({ sceneId: otherSceneId, createdBy: ownerId })
			.returning({ id: schema.sceneSettings.id })

		await db.transaction((tx) =>
			replaceHotspots(tx, sceneSettingsId, [
				hotspot({ id: contestedId, name: 'Owned' })
			])
		)

		await expect(
			db.transaction((tx) =>
				replaceHotspots(tx, otherSettings.id, [
					hotspot({ id: contestedId, name: 'Taken over' })
				])
			)
		).rejects.toThrow()

		const [owned] = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, sceneSettingsId)
		)
		const rivalRows = await db.transaction((tx) =>
			getHotspotsBySceneSettingsId(tx, otherSettings.id)
		)

		expect(owned.name).toBe('Owned')
		expect(rivalRows).toEqual([])
	})
})
