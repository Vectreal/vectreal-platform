/**
 * A scene the caller cannot see is a 404, whichever way they ask for it.
 *
 * Three ways it was not. `getScene` threw for a non-member instead of
 * returning null, so every caller's `if (!scene)` 404 was skipped and the
 * throw became a 500. The `/preview` loader returned its refusals as data, so
 * the page rendered and the viewer booted before failing its own fetch. And a
 * key-token request with a malformed project id reached a uuid comparison,
 * which Postgres rejects rather than matching nothing.
 *
 * Opt-in, because it writes to whatever `DATABASE_URL` points at:
 *
 *   pnpm nx run vectreal-platform:supabase-start
 *   pnpm nx run vectreal-platform:test-integration
 */

import { randomUUID } from 'node:crypto'

import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// The user `getAuthUser` resolves to; empty means signed out.
const sessionUser = vi.hoisted(() => ({ id: '' }))

vi.mock('../../app/lib/http/auth.server', () => ({
	getAuthUser: async () =>
		sessionUser.id
			? { user: { id: sessionUser.id }, headers: new Headers() }
			: new Response('Unauthorized', { status: 401 })
}))

type Schema = typeof import('../../app/db/schema')
type Repository =
	typeof import('../../app/lib/domain/scene/server/scene-folder-repository.server')
type SceneRoute = typeof import('../../app/routes/api/scenes.$sceneId')
type AssetRoute =
	typeof import('../../app/routes/api/scenes.$sceneId.assets.$assetId')
type PreviewLayout = typeof import('../../app/routes/layouts/preview-layout')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

describe('scene access refusals', () => {
	let schema: Schema
	let getScene: Repository['getScene']
	let sceneAction: SceneRoute['action']
	let sceneLoader: SceneRoute['loader']
	let previewLoader: PreviewLayout['loader']
	let assetLoader: AssetRoute['loader']
	let db: Db

	// A member of organization A, and a stranger to organization B.
	const memberId = randomUUID()
	const ownerBId = randomUUID()
	const organizationAId = randomUUID()
	const organizationBId = randomUUID()
	const projectAId = randomUUID()
	const projectBId = randomUUID()
	const sceneAId = randomUUID()
	const sceneBId = randomUUID()

	async function thrownBy(run: () => Promise<unknown>): Promise<Response> {
		try {
			await run()
		} catch (error) {
			if (error instanceof Response) return error
			throw error
		}
		throw new Error('expected the loader to throw a response')
	}

	function previewDocument(projectId: string, sceneId: string) {
		return previewLoader({
			request: new Request(`http://localhost/preview/${projectId}/${sceneId}`),
			params: { projectId, sceneId }
		} as never)
	}

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ getScene } =
			await import('../../app/lib/domain/scene/server/scene-folder-repository.server'))
		;({ action: sceneAction, loader: sceneLoader } =
			await import('../../app/routes/api/scenes.$sceneId'))
		;({ loader: previewLoader } =
			await import('../../app/routes/layouts/preview-layout'))
		;({ loader: assetLoader } =
			await import('../../app/routes/api/scenes.$sceneId.assets.$assetId'))
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.users).values([
			{ id: memberId, email: `member-${memberId}@refusal.test`, name: 'M' },
			{ id: ownerBId, email: `owner-${ownerBId}@refusal.test`, name: 'B' }
		])
		await db.insert(schema.organizations).values([
			{ id: organizationAId, name: `a-${organizationAId}`, ownerId: memberId },
			{ id: organizationBId, name: `b-${organizationBId}`, ownerId: ownerBId }
		])
		await db.insert(schema.organizationMemberships).values([
			{ userId: memberId, organizationId: organizationAId, role: 'owner' },
			{ userId: ownerBId, organizationId: organizationBId, role: 'owner' }
		])
		await db.insert(schema.projects).values([
			{
				id: projectAId,
				organizationId: organizationAId,
				name: 'A',
				slug: `a-${projectAId}`
			},
			{
				id: projectBId,
				organizationId: organizationBId,
				name: 'B',
				slug: `b-${projectBId}`
			}
		])
		await db.insert(schema.scenes).values([
			{ id: sceneAId, projectId: projectAId, name: 'A scene', status: 'draft' },
			{ id: sceneBId, projectId: projectBId, name: 'B scene', status: 'draft' }
		])
	})

	afterAll(async () => {
		// Organizations cascade to projects and scenes.
		await db
			.delete(schema.organizations)
			.where(
				inArray(schema.organizations.id, [organizationAId, organizationBId])
			)
		await db
			.delete(schema.users)
			.where(inArray(schema.users.id, [memberId, ownerBId]))
	})

	describe('getScene', () => {
		it("answers null for a scene in another organization's project", async () => {
			await expect(getScene(sceneBId, memberId)).resolves.toBeNull()
		})

		it('answers null for a scene that does not exist', async () => {
			await expect(getScene(randomUUID(), memberId)).resolves.toBeNull()
		})

		it('still returns a member their own scene', async () => {
			const scene = await getScene(sceneAId, memberId)
			expect(scene?.id).toBe(sceneAId)
		})
	})

	describe('the session preview POST', () => {
		it("answers 404 for another organization's scene through the caller's own project", async () => {
			// The project check passes, because the caller belongs to A; only the
			// scene is a stranger's. This is the path that reached `getScene`.
			sessionUser.id = memberId
			const body = new FormData()
			body.append('action', 'get-scene-settings')
			body.append('sceneId', sceneBId)

			const response = (await sceneAction({
				request: new Request(
					`http://localhost/api/scenes/${sceneBId}?preview=1&projectId=${projectAId}`,
					{ method: 'POST', headers: { origin: 'http://localhost' }, body }
				),
				params: { sceneId: sceneBId }
			} as never)) as Response

			expect(response.status).toBe(404)
			expect(response.headers.get('cache-control')).toContain('no-store')
		})
	})

	describe('the /preview document', () => {
		it("throws 404 for another organization's scene", async () => {
			sessionUser.id = memberId
			const response = await thrownBy(() =>
				previewDocument(projectBId, sceneBId)
			)

			expect(response.status).toBe(404)
			expect(response.headers.get('cache-control')).toContain('no-store')
		})

		it('throws 404 when signed out', async () => {
			sessionUser.id = ''
			const response = await thrownBy(() =>
				previewDocument(projectAId, sceneAId)
			)

			expect(response.status).toBe(404)
		})

		it('throws 404 for a malformed id, the same as an unknown one', async () => {
			sessionUser.id = memberId
			const response = await thrownBy(() =>
				previewDocument('not-a-uuid', sceneAId)
			)

			expect(response.status).toBe(404)
		})

		it('still renders a member their own scene', async () => {
			sessionUser.id = memberId
			const result = await previewDocument(projectAId, sceneAId)

			expect(result).not.toBeInstanceOf(Response)
		})
	})

	describe('a key-token preview request', () => {
		it('answers 404 for a malformed project id', async () => {
			const response = (await sceneLoader({
				request: new Request(
					`http://localhost/api/scenes/${sceneAId}?preview=1&projectId=p&token=vctrl_not_a_key`
				),
				params: { sceneId: sceneAId }
			} as never)) as Response

			expect(response.status).toBe(404)
		})

		it('answers 404 for a malformed project id on an asset', async () => {
			const assetId = randomUUID()
			const response = (await assetLoader({
				request: new Request(
					`http://localhost/api/scenes/${sceneAId}/assets/${assetId}?preview=1&projectId=p&token=vctrl_not_a_key`
				),
				params: { sceneId: sceneAId, assetId }
			} as never)) as Response

			expect(response.status).toBe(404)
		})
	})
})
