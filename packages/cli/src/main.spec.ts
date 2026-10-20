import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { type CliContext } from './context'
import { loadSession, readConfig, saveSession } from './credentials'
import { EXIT } from './errors'
import { browserCommand, HELP, invocationDir, run } from './main'
import {
	fakeAuthorizationServer,
	freePort,
	memoryStore,
	type FakeAuthorizationServer
} from './test-support'

const ORIGIN = 'http://localhost:4200'

const me = {
	user: { id: 'u1', email: 'ada@example.test' },
	organization: { id: 'o1', name: 'Acme', role: 'owner' },
	client: { id: 'cli-client' },
	scopes: ['projects:read', 'projects:write'],
	plan: { plan: 'pro', billingState: 'active' }
}

let auth: FakeAuthorizationServer | undefined
afterEach(async () => {
	await auth?.close()
	auth = undefined
})

/**
 * A context against a fake Vectreal API. Requests to the fake authorization
 * server go out for real; `api` answers everything else by method and path.
 */
function fakeContext(
	api: Record<string, (request: Request) => Response | Promise<Response>> = {}
) {
	const out: string[] = []
	const err: string[] = []
	const requests: Request[] = []
	const ok = (data: unknown, status = 200) =>
		Response.json({ success: true, data }, { status })
	const routes: typeof api = {
		'GET /api/v1/me': () => ok(me),
		...api
	}
	const context: CliContext = {
		env: {},
		cwd: mkdtempSync(join(tmpdir(), 'vectreal-cwd-')),
		out: (text) => out.push(text),
		err: (text) => err.push(text),
		store: memoryStore(),
		configDir: join(
			mkdtempSync(join(tmpdir(), 'vectreal-config-')),
			'vectreal'
		),
		fetch: async (input, init) => {
			const request = new Request(input, init)
			if (auth && request.url.startsWith(auth.url)) return fetch(request)
			requests.push(request)
			const route = routes[`${request.method} ${new URL(request.url).pathname}`]
			return route
				? route(request)
				: Response.json({ success: false, error: 'Not found' }, { status: 404 })
		},
		openBrowser: () => undefined
	}
	return { context, out, err, requests, ok }
}

function signInStored(
	context: CliContext,
	authorizationServer = 'http://127.0.0.1:1/auth/v1'
) {
	saveSession(context.store, ORIGIN, {
		clientId: 'cli-client',
		authorizationServer,
		accessToken: 'access-0',
		refreshToken: 'refresh-0',
		expiresAt: Date.now() + 3_600_000
	})
}

describe('vectreal', () => {
	it('prints help with exit 0, and refuses unknown commands and flags with 2', async () => {
		const { context, out, err } = fakeContext()
		expect(await run(['--help'], context)).toBe(EXIT.ok)
		expect(out).toEqual([HELP])
		expect(await run(['deploy'], context)).toBe(EXIT.usage)
		expect(await run(['whoami', '--colour'], context)).toBe(EXIT.usage)
		expect(err.join('\n')).toContain('Unknown command: deploy')
	})

	it('keeps stdout empty on a usage error, even with no command at all', async () => {
		const { context, out, err } = fakeContext()
		expect(await run(['--json'], context)).toBe(EXIT.usage)
		expect(out).toEqual([])
		expect(err).toEqual([HELP])
	})

	it('exits 3 when not signed in', async () => {
		const { context, err } = fakeContext()
		expect(await run(['whoami', '--origin', ORIGIN], context)).toBe(
			EXIT.notSignedIn
		)
		expect(err.join('\n')).toContain('vectreal login')
	})

	it('exits 3 when the server refuses the token, as after a revoke', async () => {
		const { context, err } = fakeContext({
			'GET /api/v1/me': () =>
				Response.json(
					{ success: false, error: 'Session revoked', code: 'invalid_token' },
					{ status: 401 }
				)
		})
		signInStored(context)

		expect(await run(['whoami', '--origin', ORIGIN], context)).toBe(
			EXIT.notSignedIn
		)
		expect(err.join('\n')).toContain('vectreal login')
	})

	it('whoami --json writes only JSON to stdout, signed with the stored token', async () => {
		const { context, out, requests } = fakeContext()
		signInStored(context)

		expect(await run(['whoami', '--json', '--origin', ORIGIN], context)).toBe(
			EXIT.ok
		)
		expect(out).toHaveLength(1)
		expect(JSON.parse(out[0])).toMatchObject({ origin: ORIGIN, ...me })
		expect(requests[0].headers.get('Authorization')).toBe('Bearer access-0')
	})

	it('login signs in, keeps the session and remembers the origin', async () => {
		auth = await fakeAuthorizationServer({ challenge: () => challenge })
		let challenge: string | undefined
		const port = await freePort()
		const { context, out } = fakeContext({
			'GET /api/v1/cli/client': () =>
				Response.json({
					success: true,
					data: {
						client_id: 'cli-client',
						redirect_uris: [`http://127.0.0.1:${port}/callback`],
						authorization_server: auth!.url
					}
				})
		})
		context.openBrowser = (href) => {
			const authorize = new URL(href)
			challenge = authorize.searchParams.get('code_challenge') ?? undefined
			const callback = new URL(authorize.searchParams.get('redirect_uri')!)
			callback.searchParams.set('code', 'the-code')
			callback.searchParams.set('state', authorize.searchParams.get('state')!)
			void fetch(callback)
		}

		expect(await run(['login', '--origin', ORIGIN], context)).toBe(EXIT.ok)
		expect(loadSession(context.store, ORIGIN)).toMatchObject({
			clientId: 'cli-client',
			authorizationServer: auth.url,
			accessToken: 'access-1',
			refreshToken: 'refresh-1'
		})
		expect(readConfig(context.configDir).defaultOrigin).toBe(ORIGIN)
		expect(out[0]).toContain('Acme (owner)')
	})

	it('init --create makes a project and records it for this directory', async () => {
		const { context } = fakeContext({
			'POST /api/v1/projects': async (request) =>
				Response.json(
					{
						success: true,
						data: { project: { id: 'p1', name: (await request.json()).name } }
					},
					{ status: 201 }
				)
		})
		signInStored(context)

		expect(
			await run(['init', '--create', 'Demo', '--origin', ORIGIN], context)
		).toBe(EXIT.ok)
		expect(
			JSON.parse(
				readFileSync(join(context.cwd, '.vectreal', 'project.json'), 'utf8')
			)
		).toEqual({ origin: ORIGIN, projectId: 'p1' })
	})

	it('init --project refuses a project outside the organization', async () => {
		const { context } = fakeContext({
			'GET /api/v1/projects': () =>
				Response.json({
					success: true,
					data: { projects: [{ id: 'p1', name: 'A' }] }
				})
		})
		signInStored(context)

		expect(
			await run(['init', '--project', 'p2', '--origin', ORIGIN], context)
		).toBe(EXIT.usage)
	})

	it('logout ends the session on the server with its token, then forgets it', async () => {
		const { context, err, requests } = fakeContext({
			'DELETE /api/v1/session': () =>
				Response.json({ success: true, data: { signedOut: true } })
		})
		signInStored(context)

		expect(await run(['logout', '--origin', ORIGIN], context)).toBe(EXIT.ok)
		expect(requests.map((request) => request.method)).toEqual(['DELETE'])
		expect(requests[0].headers.get('Authorization')).toBe('Bearer access-0')
		expect(loadSession(context.store, ORIGIN)).toBeNull()
		expect(err).toEqual([])
	})

	it('logout warns when the API refuses the token, which may leave the session alive', async () => {
		// invalid_token also answers a live session whose grant is gone, and
		// then the route never reaches the sign-out.
		const { context, err } = fakeContext({
			'DELETE /api/v1/session': () =>
				Response.json(
					{ success: false, error: 'No grant', code: 'invalid_token' },
					{ status: 401 }
				)
		})
		signInStored(context)

		expect(await run(['logout', '--origin', ORIGIN], context)).toBe(EXIT.ok)
		expect(loadSession(context.store, ORIGIN)).toBeNull()
		expect(err.join('\n')).toContain(`${ORIGIN}/dashboard/connected-agents`)
	})

	it('logout treats a session whose refresh Auth refuses as ended', async () => {
		auth = await fakeAuthorizationServer()
		auth.answers = [
			{ status: 400, body: { error_code: 'refresh_token_not_found' } }
		]
		const { context, err, requests } = fakeContext()
		saveSession(context.store, ORIGIN, {
			clientId: 'cli-client',
			authorizationServer: auth.url,
			accessToken: 'access-0',
			refreshToken: 'refresh-0',
			expiresAt: Date.now() - 1000
		})

		expect(await run(['logout', '--origin', ORIGIN], context)).toBe(EXIT.ok)
		expect(requests).toEqual([])
		expect(loadSession(context.store, ORIGIN)).toBeNull()
		expect(err).toEqual([])
	})

	it('logout still forgets the session when the server fails, and says where to revoke', async () => {
		const { context, err } = fakeContext({
			'DELETE /api/v1/session': () =>
				new Response('Bad Gateway', { status: 502 })
		})
		signInStored(context)

		expect(await run(['logout', '--origin', ORIGIN], context)).toBe(EXIT.ok)
		expect(loadSession(context.store, ORIGIN)).toBeNull()
		expect(err.join('\n')).toContain(`${ORIGIN}/dashboard/connected-agents`)
	})

	it('init asks which project when none is named', async () => {
		const { context } = fakeContext({
			'GET /api/v1/projects': () =>
				Response.json({
					success: true,
					data: {
						projects: [
							{ id: 'p1', name: 'A' },
							{ id: 'p2', name: 'B' }
						]
					}
				})
		})
		context.ask = async () => '2'
		signInStored(context)

		expect(await run(['init', '--origin', ORIGIN], context)).toBe(EXIT.ok)
		expect(
			JSON.parse(
				readFileSync(join(context.cwd, '.vectreal', 'project.json'), 'utf8')
			).projectId
		).toBe('p2')

		context.ask = undefined
		expect(await run(['init', '--origin', ORIGIN], context)).toBe(EXIT.usage)
	})
})

describe('invocationDir', () => {
	it('is where pnpm was called from, not the workspace root it runs the script in', () => {
		expect(invocationDir({ INIT_CWD: '/work/scene' }, '/work')).toBe(
			'/work/scene'
		)
		expect(invocationDir({}, '/work/scene')).toBe('/work/scene')
	})
})

describe('browserCommand', () => {
	const url =
		'https://api.vectreal.com/auth/v1/oauth/authorize?response_type=code&client_id=c&state=s'

	it('hands the whole URL to the opener as one argument, with no shell', () => {
		for (const platform of ['darwin', 'win32', 'linux'] as const) {
			const [command, args] = browserCommand(platform, url)
			expect(args.at(-1), platform).toBe(url)
			expect(['cmd', 'sh', 'bash'], platform).not.toContain(command)
		}
		expect(browserCommand('win32', url)).toEqual([
			'rundll32',
			['url.dll,FileProtocolHandler', url]
		])
	})
})
