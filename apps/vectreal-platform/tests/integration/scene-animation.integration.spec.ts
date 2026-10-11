/**
 * Round-trips a scene's animation settings through a real Postgres, the way a
 * save does: parsed from the request, upserted into `scene_settings`, read
 * back through `rowToSceneSettings`.
 *
 * The unit specs hold each half. What only a database proves is that the
 * column exists and stores the whole config, and that a save of unchanged
 * settings compares equal against what came back, so reopening a saved
 * animated scene does not report it as edited.
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

import type { AnimationSettings, SceneSettings } from '@vctrl/core'

type Schema = typeof import('../../app/db/schema')
type Repository =
	typeof import('../../app/lib/domain/scene/server/scene-settings-repository.server')
type Parser =
	typeof import('../../app/lib/domain/scene/server/scene-settings.parser.server')
type Comparison =
	typeof import('../../app/lib/domain/scene/scene-settings-comparison')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

const animation: AnimationSettings = {
	enabled: true,
	mode: 'sequence',
	autoplay: false,
	loopSequence: true,
	showControls: true,
	clips: [
		{
			clipId: 'walk',
			sourceName: 'Walk',
			sourceIndex: 0,
			enabled: true,
			order: 1,
			loop: 'ping_pong',
			repetitions: 3,
			timeScale: 1.5,
			startOffset: 0.25
		},
		{
			clipId: 'run',
			sourceName: 'Run',
			sourceIndex: 1,
			enabled: false,
			order: 0,
			loop: 'once',
			timeScale: 1,
			startOffset: 0
		}
	]
}

describe('animation settings persistence', () => {
	let schema: Schema
	let repository: Repository
	let SceneSettingsParser: Parser['SceneSettingsParser']
	let haveSceneSettingsChanged: Comparison['haveSceneSettingsChanged']
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const sceneId = randomUUID()

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		repository =
			await import('../../app/lib/domain/scene/server/scene-settings-repository.server')
		;({ SceneSettingsParser } =
			await import('../../app/lib/domain/scene/server/scene-settings.parser.server'))
		;({ haveSceneSettingsChanged } =
			await import('../../app/lib/domain/scene/scene-settings-comparison'))
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
			name: 'animation smoke'
		})
	})

	afterAll(async () => {
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	it('saves the whole config and reads it back unchanged', async () => {
		const request = SceneSettingsParser.parseSceneSettingsRequestData({
			action: 'update',
			sceneId,
			settings: { animation }
		})
		if (request instanceof Response) throw new Error('the parser refused it')
		const settings = request.settings as SceneSettings

		await db.transaction((tx) =>
			repository.upsertSceneSettings(tx, {
				sceneId,
				createdBy: ownerId,
				settings
			} as Parameters<Repository['upsertSceneSettings']>[1])
		)

		const row = await db.transaction((tx) =>
			repository.getSceneSettingsBySceneId(tx, sceneId)
		)
		if (!row) throw new Error('no settings row was written')

		expect(repository.rowToSceneSettings(row).animation).toEqual(animation)
		expect(haveSceneSettingsChanged(settings, row, [])).toBe(false)
	})
})
