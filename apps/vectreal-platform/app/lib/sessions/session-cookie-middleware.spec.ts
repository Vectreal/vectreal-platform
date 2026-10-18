/**
 * The session cookie middleware against the real per-request Supabase client
 * cache. Supabase's own cookie write is stood in for by appending to the
 * client's Headers, which is exactly what its `setAll` does on a refresh.
 */

import { createRequestHandler, type ServerBuild } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sessionCookieMiddleware } from './session-cookie-middleware'
import { createSupabaseClient } from '../supabase.server'

const ROTATED = 'sb-127-auth-token=rotated; Path=/; HttpOnly; SameSite=Lax'
const URL_ = 'https://vectreal.com/dashboard'

type Args = Parameters<typeof sessionCookieMiddleware>[0]

/**
 * Runs the middleware around a "route" that receives its own fresh Request,
 * as React Router gives the loaders that revalidate after a document POST,
 * and lets that route refresh the session before answering.
 */
function run(
	route: (routeRequest: Request) => Promise<Response>,
	request = new Request(URL_)
) {
	const args = { request, params: {}, context: {} } as unknown as Args
	return sessionCookieMiddleware(args, () =>
		route(new Request(request.url, { headers: request.headers }))
	) as Promise<Response>
}

async function refresh(routeRequest: Request) {
	const { headers } = await createSupabaseClient(routeRequest)
	headers.append('Set-Cookie', ROTATED)
}

beforeEach(() => {
	vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321')
	vi.stubEnv('SUPABASE_KEY', 'sb_publishable_test')
})

describe('sessionCookieMiddleware', () => {
	it('puts a refreshed session cookie on an error page that dropped it', async () => {
		const response = await run(async (routeRequest) => {
			await refresh(routeRequest)
			return new Response('<html>500</html>', {
				status: 500,
				headers: { 'Content-Type': 'text/html' }
			})
		})

		expect(response.status).toBe(500)
		expect(response.headers.getSetCookie()).toEqual([ROTATED])
		expect(response.headers.get('Content-Type')).toBe('text/html')
		await expect(response.text()).resolves.toBe('<html>500</html>')
	})

	it('gives an action and the loaders after it one client, though their Requests differ', async () => {
		const actionRequest = new Request(URL_, { method: 'POST' })
		let actionClient: unknown
		let loaderClient: unknown

		await run(async (loaderRequest) => {
			actionClient = (await createSupabaseClient(actionRequest)).client
			loaderClient = (await createSupabaseClient(loaderRequest)).client
			return new Response(null)
		}, actionRequest)

		expect(loaderClient).toBe(actionClient)
	})

	it('does not add a cookie the route already forwarded', async () => {
		const response = await run(async (routeRequest) => {
			await refresh(routeRequest)
			return new Response(null, { headers: [['Set-Cookie', ROTATED]] })
		})

		expect(response.headers.getSetCookie()).toEqual([ROTATED])
	})

	it('keeps the route’s own cookies beside the session one', async () => {
		const own = 'csrf=abc; Path=/'
		const response = await run(async (routeRequest) => {
			await refresh(routeRequest)
			return new Response(null, { headers: [['Set-Cookie', own]] })
		})

		expect(response.headers.getSetCookie()).toEqual([own, ROTATED])
	})

	it('copies a response whose headers cannot be changed', async () => {
		const response = await run(async (routeRequest) => {
			await refresh(routeRequest)
			return Response.redirect('https://vectreal.com/sign-in', 302)
		})

		expect(response.status).toBe(302)
		expect(response.headers.get('Location')).toBe(
			'https://vectreal.com/sign-in'
		)
		expect(response.headers.getSetCookie()).toEqual([ROTATED])
	})

	it('returns the response untouched when Supabase wrote nothing', async () => {
		const original = new Response('ok')

		await expect(run(async () => original)).resolves.toBe(original)
	})

	/*
	  The scene, dashboard-mutation and API-key routes no longer forward the
	  cookie on their error paths; they rely on this. So it is checked through
	  React Router's own request
	  handler rather than by calling the middleware: a root middleware has to
	  wrap a resource route's response too, not only a document's.
	*/
	it("reaches a resource route's response through React Router's handler", async () => {
		const build = {
			entry: {
				module: {
					default: () => new Response('no documents here', { status: 500 })
				}
			},
			routes: {
				root: {
					id: 'root',
					path: '',
					module: { middleware: [sessionCookieMiddleware] }
				},
				'api-route': {
					id: 'api-route',
					parentId: 'root',
					path: 'api/thing',
					module: {
						loader: async ({ request }: { request: Request }) => {
							await refresh(request)
							return Response.json({ ok: true })
						}
					}
				}
			},
			assets: {
				entry: { module: '', imports: [] },
				routes: {},
				url: '',
				version: 'test'
			},
			publicPath: '/',
			assetsBuildDirectory: '',
			future: {},
			ssr: true,
			isSpaMode: false,
			prerender: [],
			routeDiscovery: { mode: 'lazy', manifestPath: '/__manifest' }
		} as unknown as ServerBuild

		const response = await createRequestHandler(
			build,
			'production'
		)(new Request('https://vectreal.com/api/thing'))

		expect(response.status).toBe(200)
		expect(response.headers.getSetCookie()).toEqual([ROTATED])
	})

	it('runs outermost on every route, from root', async () => {
		const { middleware } = await import('../../root')
		expect(middleware[0]).toBe(sessionCookieMiddleware)
	})
})
