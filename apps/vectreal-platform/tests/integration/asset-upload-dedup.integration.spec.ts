/**
 * Asks a real Postgres whether an upload reuses the row holding the same bytes.
 *
 * The defect this pins needs duplicate rows to exist before it shows, so it
 * cannot be reproduced against a mock that returns whatever it was told to.
 * The asset folder is one per project, so every scene writes `scene.gltf` and
 * `scene-thumbnail.webp` into it; a lookup keyed on `(folder, name)` then
 * returns an arbitrary row, misses on the hash, and writes another duplicate,
 * which makes the next lookup likelier to miss. One local folder reached 103
 * rows named `scene.gltf` this way.
 *
 * Storage is faked at the `createClient` boundary; nothing here depends on
 * bytes actually moving.
 *
 * Opt-in:
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			getBucket: async () => ({ data: { name: 'assets' }, error: null }),
			createBucket: async () => ({ data: null, error: null }),
			from: () => ({
				upload: async (path: string) => ({ data: { path }, error: null }),
				remove: async () => ({ data: null, error: null })
			})
		}
	})
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type Storage = typeof import('../../app/lib/domain/asset/asset-storage.server')

describe('asset upload de-duplication', () => {
	let schema: Schema
	let db: Db
	let uploadSceneAssets: Storage['uploadSceneAssets']

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const assetFolderId = randomUUID()
	const fileName = 'collides.bin'

	const upload = async (data: Uint8Array, name: string = fileName) => {
		const [result] = await uploadSceneAssets(
			randomUUID(),
			ownerId,
			projectId,
			[
				{
					fileName: name,
					data,
					mimeType: 'application/octet-stream',
					type: 'buffer'
				}
			]
		)
		return result.assetId
	}

	/**
	 * Links an asset to a throwaway scene. Reuse is only offered for rows
	 * something already references, so an unreferenced fixture would never be a
	 * dedupe candidate and the test would prove nothing.
	 */
	const reference = async (assetId: string) => {
		const sceneId = randomUUID()
		await db
			.insert(schema.scenes)
			.values({ id: sceneId, projectId, folderId: null, name: `s-${sceneId}` })
		const settingsId = randomUUID()
		await db
			.insert(schema.sceneSettings)
			.values({ id: settingsId, sceneId, createdBy: ownerId })
		await db
			.insert(schema.sceneAssets)
			.values({ sceneSettingsId: settingsId, assetId })
	}

	const contentHashOf = async (assetId: string) => {
		const [row] = await db
			.select({ metadata: schema.assets.metadata })
			.from(schema.assets)
			.where(eq(schema.assets.id, assetId))
		return (row?.metadata as { contentHash?: string } | null)?.contentHash
	}

	const rowsNamed = async () =>
		db
			.select({ id: schema.assets.id })
			.from(schema.assets)
			.where(
				and(
					eq(schema.assets.folderId, assetFolderId),
					eq(schema.assets.name, fileName)
				)
			)

	beforeAll(async () => {
		process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321'
		process.env.SUPABASE_SECRET_KEY ??= 'integration-test-key'

		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		;({ uploadSceneAssets } =
			await import('../../app/lib/domain/asset/asset-storage.server'))

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
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('does not share a row that no scene references yet', async () => {
		// An unreferenced row belongs to an upload batch that has not committed.
		// Handing it to a second batch would put one row under two owners, and
		// whichever batch failed first would collect it out from under the other.
		// Two uploads of identical bytes must therefore produce two rows.
		const bytes = new Uint8Array([4, 4, 4, 4])

		const first = await upload(bytes, 'in-flight.bin')
		const second = await upload(bytes, 'in-flight.bin')

		expect(second).not.toBe(first)
	})

	it('reuses a row once a scene references it', async () => {
		// The other half. Deduplication still has to work, or every save rewrites
		// every unchanged texture; a referenced row is one
		// `selectUnreferencedAssetIds` will never let a collector delete, so
		// sharing it is safe.
		const bytes = new Uint8Array([5, 5, 5, 5])

		const created = await upload(bytes, 'reusable.bin')
		await reference(created)

		expect(await upload(bytes, 'reusable.bin')).toBe(created)
	})

	it('reuses the row holding these bytes, not an arbitrary namesake', async () => {
		// Several same-named rows with different bytes go in first, so a lookup
		// keyed on the name alone has to walk past a wrong answer before it could
		// reach the right one. With a single decoy the old implementation passed
		// or failed on whichever row the planner happened to return first; the
		// assertion was about the query plan rather than about the code.
		const decoys: string[] = []
		for (const byte of [9, 8, 7, 6]) {
			const decoy = await upload(new Uint8Array([byte, byte, byte]))
			await reference(decoy)
			decoys.push(decoy)
		}

		const wantedBytes = new Uint8Array([1, 2, 3])
		const wanted = await upload(wantedBytes)
		await reference(wanted)

		expect(decoys).not.toContain(wanted)
		expect(await rowsNamed()).toHaveLength(decoys.length + 1)

		const reused = await upload(wantedBytes)

		// Identity is the hash, so assert on the hash rather than only on the id.
		expect(reused).toBe(wanted)
		expect(await contentHashOf(reused)).toBe(await contentHashOf(wanted))
		expect(await rowsNamed()).toHaveLength(decoys.length + 1)
	})
})
