/**
 * A malformed id in a scene URL is a 404, never a 500.
 *
 * Every id these routes take reaches a uuid column, and Postgres rejects a
 * malformed one outright rather than matching nothing. Before this, that
 * driver error surfaced as a 500 on input anyone can send. Each case here
 * drives the real route with an id no row could have.
 *
 * The key-token cases use a live key and a published scene, so the
 * malformed id is the only thing left to refuse: with a key that matches
 * nothing, the request is refused before the id is ever read.
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

// The signed-in user; a stranger unless a case names the scene's owner.
const sessionUser = vi.hoisted(() => ({ id: '' }))

vi.mock('../../app/lib/http/auth.server', () => ({
	getAuthUser: async () => ({
		user: { id: sessionUser.id },
		headers: new Headers()
	})
}))

type Schema = typeof import('../../app/db/schema')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>
type SceneRoute = typeof import('../../app/routes/api/scenes.$sceneId')
type AssetRoute =
	typeof import('../../app/routes/api/scenes.$sceneId.assets.$assetId')

/*
  Imported by a computed specifier, untyped. A literal import puts the module
  in the spec tsconfig's program, which carries only `+future.ts` of the route
  types, so its `Route` params lose their registry and its own code stops
  type-checking.
*/
const DASHBOARD_SCENE_ROUTE = '../../app/routes/dashboard-page/projects/scene'
type DashboardSceneLoader = (args: never) => Promise<unknown>

const MALFORMED = 'not-a-uuid'

describe('malformed ids in scene URLs', () => {
	let sceneLoader: SceneRoute['loader']
	let sceneAction: SceneRoute['action']
	let assetLoader: AssetRoute['loader']
	let dashboardSceneLoader: DashboardSceneLoader
	let schema: Schema
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	const folderId = randomUUID()
	const assetId = randomUUID()
	const sceneId = randomUUID()
	let apiKeyId: string
	let token: string

	/** Same host as the request, which the embed domain check allows outright. */
	const KEY_HEADERS = { referer: 'http://localhost/product' }

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		db = (await import('../../app/db/client')).getDbClient()
		const { createApiKey } =
			await import('../../app/lib/domain/auth/api-key-repository.server')

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@malformed.test`,
			name: 'Owner'
		})
		await db
			.insert(schema.organizations)
			.values({ id: organizationId, name: `m-${organizationId}`, ownerId })
		await db.insert(schema.organizationMemberships).values({
			userId: ownerId,
			organizationId,
			role: 'owner'
		})
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Malformed project',
			slug: `m-${projectId}`
		})
		await db
			.insert(schema.folders)
			.values({ id: folderId, projectId, name: 'Scene Assets' })
		await db.insert(schema.assets).values({
			id: assetId,
			folderId,
			name: 'chair.glb',
			type: 'model',
			filePath: `malformed/${assetId}.glb`,
			mimeType: 'model/gltf-binary',
			fileSize: 1024,
			ownerId
		})
		await db.insert(schema.scenes).values({
			id: sceneId,
			projectId,
			name: 'Published chair',
			status: 'published'
		})
		await db
			.insert(schema.sceneSettings)
			.values({ sceneId, createdBy: ownerId })
		await db
			.insert(schema.scenePublished)
			.values({ sceneId, assetId, publishedBy: ownerId })

		const created = await createApiKey({
			userId: ownerId,
			organizationId,
			name: 'Malformed id key',
			description: 'Integration test',
			projectIds: [projectId]
		})
		apiKeyId = created.apiKey.id
		token = created.plaintext

		;({ loader: sceneLoader, action: sceneAction } =
			await import('../../app/routes/api/scenes.$sceneId'))
		;({ loader: assetLoader } =
			await import('../../app/routes/api/scenes.$sceneId.assets.$assetId'))
		;({ loader: dashboardSceneLoader } = (await import(
			/* @vite-ignore */ DASHBOARD_SCENE_ROUTE
		)) as { loader: DashboardSceneLoader })
	})

	afterAll(async () => {
		if (!db) return
		await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, apiKeyId))
		// Organizations cascade to projects, folders, scenes and assets.
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	function getScene(sceneId: string, query = '') {
		return sceneLoader({
			request: new Request(`http://localhost/api/scenes/${sceneId}${query}`, {
				headers: KEY_HEADERS
			}),
			params: { sceneId }
		} as never) as Promise<Response>
	}

	function getAsset(sceneId: string, assetId: string) {
		return assetLoader({
			request: new Request(
				`http://localhost/api/scenes/${sceneId}/assets/${assetId}`
			),
			params: { sceneId, assetId }
		} as never) as Promise<Response>
	}

	function postScene(sceneId: string | undefined, fields: [string, string][]) {
		const body = new FormData()
		for (const [key, value] of fields) body.append(key, value)
		const path = sceneId ? `/api/scenes/${sceneId}` : '/api/scenes'

		return sceneAction({
			request: new Request(`http://localhost${path}`, {
				method: 'POST',
				headers: { origin: 'http://localhost' },
				body
			}),
			params: { sceneId }
		} as never) as Promise<Response>
	}

	it('answers 404 for the signed-in manifest', async () => {
		const response = await getScene(MALFORMED)
		expect(response.status).toBe(404)
	})

	it('answers 404 for a live key with a malformed scene id', async () => {
		const response = await getScene(
			MALFORMED,
			`?preview=1&projectId=${projectId}&token=${token}`
		)
		expect(response.status).toBe(404)
	})

	it('still serves a live key the published scene', async () => {
		const response = await getScene(
			sceneId,
			`?preview=1&projectId=${projectId}&token=${token}`
		)
		expect(response.status).toBe(200)
	})

	it('answers 404 for a signed-in preview with a malformed project id', async () => {
		const response = await getScene(
			randomUUID(),
			`?preview=1&projectId=${MALFORMED}`
		)
		expect(response.status).toBe(404)
		expect(response.headers.get('cache-control')).toContain('no-store')
	})

	it('answers 404 for an action on a malformed scene id', async () => {
		const response = await postScene(MALFORMED, [
			['action', 'get-scene-settings']
		])
		expect(response.status).toBe(404)
	})

	it('lets a request with no scene id through to its own checks', async () => {
		// A first save posts to `/api/scenes`; absent is not malformed.
		const response = await postScene(undefined, [])
		expect(response.status).toBe(400)
	})

	beforeEach(() => {
		sessionUser.id = randomUUID()
	})

	it('answers 404 for a malformed asset id, asked by a member of the scene', async () => {
		// A member passes the membership gate, so the asset id is the only thing
		// left to refuse; it would otherwise reach the scene_assets link check.
		sessionUser.id = ownerId
		const response = await getAsset(sceneId, MALFORMED)
		expect(response.status).toBe(404)
	})

	it('answers 404 for a signed-in asset request', async () => {
		const response = await getAsset(MALFORMED, randomUUID())
		expect(response.status).toBe(404)
	})

	it('throws 404 from the dashboard scene page', async () => {
		let thrown: unknown
		try {
			await dashboardSceneLoader({
				request: new Request(
					`http://localhost/dashboard/projects/${MALFORMED}/${randomUUID()}`
				),
				params: { projectId: MALFORMED, sceneId: randomUUID() }
			} as never)
		} catch (error) {
			thrown = error
		}
		expect(thrown).toBeInstanceOf(Response)
		expect((thrown as Response).status).toBe(404)
	})
})
