/**
 * Every refusal the embed loader makes, driven through the real loader.
 *
 * The unit specs read the loader's source, because it reaches `getDbClient()`
 * on import. Only this one proves what a request actually gets: each refusal
 * is thrown, so the embed boundary renders it instead of the viewer booting
 * into a spinner; each carries the embed header contract; and the four that
 * answer "not available" are indistinguishable, so the embed is not an oracle
 * for whether a scene or key exists.
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

import { EMBED_RESPONSE_HEADERS } from '../../app/lib/domain/embed/embed-response-headers'

type Schema = typeof import('../../app/db/schema')
type Repository =
	typeof import('../../app/lib/domain/auth/api-key-repository.server')
type Layout = typeof import('../../app/routes/layouts/embed-layout')
type Db = ReturnType<typeof import('../../app/db/client').getDbClient>

interface Thrown {
	data: unknown
	init: ResponseInit | null
}

describe('embed loader refusals', () => {
	// Loaded in `beforeAll` rather than at module scope: these modules call
	// `getDbClient()` on import, which throws without a `DATABASE_URL`.
	let schema: Schema
	let createApiKey: Repository['createApiKey']
	let loader: Layout['loader']
	let db: Db

	const ownerId = randomUUID()
	const organizationId = randomUUID()
	const projectId = randomUUID()
	// Never published, and never inserted at all: the loader must not be able
	// to tell an unpublished scene from one that does not exist.
	const sceneId = randomUUID()

	let apiKeyId: string
	let token: string

	beforeAll(async () => {
		schema = await import('../../app/db/schema')
		;({ createApiKey } =
			await import('../../app/lib/domain/auth/api-key-repository.server'))
		;({ loader } = await import('../../app/routes/layouts/embed-layout'))
		db = (await import('../../app/db/client')).getDbClient()

		await db.insert(schema.users).values({
			id: ownerId,
			email: `owner-${ownerId}@refusal.test`,
			name: 'Owner'
		})
		await db.insert(schema.organizations).values({
			id: organizationId,
			name: `refusal-${organizationId}`,
			ownerId
		})
		await db.insert(schema.organizationMemberships).values({
			userId: ownerId,
			organizationId,
			role: 'owner'
		})
		await db.insert(schema.projects).values({
			id: projectId,
			organizationId,
			name: 'Refusal project',
			slug: `refusal-${projectId}`
		})

		const created = await createApiKey({
			userId: ownerId,
			organizationId,
			name: 'Storefront key',
			description: 'Pasted into a product page',
			projectIds: [projectId]
		})
		apiKeyId = created.apiKey.id
		token = created.plaintext
	})

	afterAll(async () => {
		if (!db) return
		await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, apiKeyId))
		await db.delete(schema.projects).where(eq(schema.projects.id, projectId))
		await db
			.delete(schema.organizationMemberships)
			.where(eq(schema.organizationMemberships.userId, ownerId))
		await db
			.delete(schema.organizations)
			.where(eq(schema.organizations.id, organizationId))
		await db.delete(schema.users).where(eq(schema.users.id, ownerId))
	})

	/**
	 * The referer host matches the application host, which
	 * `isEmbedRequestHostAllowed` allows outright, so nothing here turns on the
	 * project's domain list.
	 */
	async function refusalFor(
		params: Record<string, string>,
		query: string
	): Promise<Thrown> {
		const request = new Request(
			`https://embed.test/embed/${params.projectId}/${params.sceneId}${query}`,
			{ headers: { referer: 'https://embed.test/product/widget' } }
		)
		try {
			await loader({ request, params, context: {} } as never)
		} catch (thrown) {
			return thrown as Thrown
		}
		throw new Error('the loader returned a refusal instead of throwing it')
	}

	const cases: [string, () => Promise<Thrown>, number][] = [
		['no token', () => refusalFor({ projectId, sceneId }, ''), 404],
		[
			'a key that matches nothing',
			() => refusalFor({ projectId, sceneId }, `?token=vctrl_${randomUUID()}`),
			404
		],
		[
			'an unpublished scene',
			() => refusalFor({ projectId, sceneId }, `?token=${token}`),
			404
		],
		[
			'a malformed URL',
			() => refusalFor({ projectId: 'not-a-uuid', sceneId }, `?token=${token}`),
			400
		]
	]

	it.each(cases)('throws for %s, answering %i', async (_, refuse, status) => {
		const thrown = await refuse()
		expect(thrown.init?.status).toBe(status)
		expect(Object.fromEntries(new Headers(thrown.init?.headers))).toEqual(
			Object.fromEntries(new Headers(EMBED_RESPONSE_HEADERS))
		)
	})

	it('says the same thing for every one of them', async () => {
		const bodies = await Promise.all(cases.map(([, refuse]) => refuse()))
		for (const thrown of bodies) {
			expect(thrown.data).toEqual({ reason: 'not_available' })
		}
	})
})
