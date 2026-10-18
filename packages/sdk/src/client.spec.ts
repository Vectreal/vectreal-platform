import { describe, expect, it, vi } from 'vitest'

import {
	createVectrealClient,
	VectrealApiError,
	VectrealContractError
} from './client'

import type { Me } from './me'

const me: Me = {
	user: { id: 'user-1', email: 'ada@example.com' },
	organization: { id: 'org-1', name: 'Acme', role: 'owner' },
	client: { id: 'client-1' },
	scopes: ['projects:read'],
	plan: { plan: 'free', billingState: 'none' }
}

const cliClient = {
	client_id: 'cli-id',
	redirect_uris: ['http://127.0.0.1:51730/callback'],
	authorization_server: 'https://api.vectreal.com/auth/v1'
}

function respond(body: unknown, status = 200) {
	return vi.fn<typeof fetch>(async () =>
		typeof body === 'string'
			? new Response(body, { status })
			: Response.json(body, { status })
	)
}

const sent = (fetch: ReturnType<typeof respond>) => {
	const [url, init] = fetch.mock.calls[0]
	return { url: String(url), headers: new Headers(init?.headers) }
}

describe('createVectrealClient', () => {
	it('asks /me with the bearer token and returns what it parsed', async () => {
		const fetch = respond({ success: true, data: me })
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: async () => 'token-1',
			fetch
		})

		await expect(client.me()).resolves.toEqual(me)
		expect(sent(fetch).url).toBe('https://vectreal.com/api/v1/me')
		expect(sent(fetch).headers.get('Authorization')).toBe('Bearer token-1')
	})

	it('asks for the CLI client without a token, even when it has one', async () => {
		const fetch = respond({ success: true, data: cliClient })
		const getAccessToken = vi.fn(() => 'token-1')
		const client = createVectrealClient({
			baseUrl: 'http://localhost:4200',
			getAccessToken,
			fetch
		})

		await expect(client.cliClient()).resolves.toEqual(cliClient)
		expect(sent(fetch).url).toBe('http://localhost:4200/api/v1/cli/client')
		expect(sent(fetch).headers.has('Authorization')).toBe(false)
		expect(getAccessToken).not.toHaveBeenCalled()
	})

	it.each(['https://host.example/vectreal', 'https://host.example/vectreal/'])(
		'keeps the path of a base URL that has one (%s)',
		async (baseUrl) => {
			const meFetch = respond({ success: true, data: me })
			await createVectrealClient({
				baseUrl,
				getAccessToken: () => 'token',
				fetch: meFetch
			}).me()
			expect(sent(meFetch).url).toBe('https://host.example/vectreal/api/v1/me')

			const cliFetch = respond({ success: true, data: cliClient })
			await createVectrealClient({ baseUrl, fetch: cliFetch }).cliClient()
			expect(sent(cliFetch).url).toBe(
				'https://host.example/vectreal/api/v1/cli/client'
			)
		}
	)

	it('reports a refusal as a VectrealApiError with the status and message', async () => {
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'expired',
			fetch: respond({ success: false, error: 'Invalid token' }, 401)
		})

		const error = await client.me().catch((caught: unknown) => caught)
		expect(error).toBeInstanceOf(VectrealApiError)
		expect(error).not.toBeInstanceOf(VectrealContractError)
		expect(error).toMatchObject({ status: 401, message: 'Invalid token' })
	})

	it('hands over the whole refusal, including fields it does not know', async () => {
		const refusal = {
			success: false,
			error: 'Project limit reached',
			quota: { limitKey: 'projects_total', limit: 3, currentValue: 3 },
			code: 'quota_exceeded'
		}
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'token',
			fetch: respond(refusal, 403)
		})

		await expect(client.me()).rejects.toMatchObject({
			name: 'VectrealApiError',
			status: 403,
			message: 'Project limit reached',
			body: refusal
		})
	})

	it('reads a 404 inside the envelope as the refusal it is, not a missing route', async () => {
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			fetch: respond(
				{ success: false, error: 'No CLI client is registered on this server' },
				404
			)
		})

		await expect(client.cliClient()).rejects.toMatchObject({
			name: 'VectrealApiError',
			status: 404,
			message: 'No CLI client is registered on this server'
		})
	})

	it('reports a body it cannot read as a VectrealContractError, never a refusal', async () => {
		const { email: _email, ...user } = me.user
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'token',
			fetch: respond({ success: true, data: { ...me, user } })
		})

		const error = await client.me().catch((caught: unknown) => caught)
		expect(error).toBeInstanceOf(VectrealContractError)
		expect(error).not.toBeInstanceOf(VectrealApiError)
		expect((error as VectrealContractError).issues[0]?.path).toEqual([
			'data',
			'user',
			'email'
		])
	})

	it.each([
		['plain text', 'Unexpected Server Error', 500],
		['a gateway JSON body', { message: 'Bad Gateway' }, 502],
		['a rate limiter page', '<html>Too Many Requests</html>', 429]
	])(
		'reports a failure outside the envelope (%s) as a server error',
		async (_label, body, status) => {
			const client = createVectrealClient({
				baseUrl: 'https://vectreal.com',
				fetch: respond(body, status)
			})

			await expect(client.cliClient()).rejects.toMatchObject({
				name: 'VectrealApiError',
				status
			})
		}
	)

	it.each([
		['a missing route, such as an older server', '<html>Not found</html>', 404],
		[
			'a 404 that looks like a success',
			{ success: true, data: cliClient },
			404
		],
		['a success that is not JSON', 'ok', 200]
	])('reports %s as a contract error', async (_label, body, status) => {
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			fetch: respond(body, status)
		})

		await expect(client.cliClient()).rejects.toMatchObject({
			name: 'VectrealContractError',
			status
		})
	})

	it('refuses an authenticated call it has no token for, before any request', async () => {
		const fetch = respond({ success: true, data: me })
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			fetch
		})

		await expect(client.me()).rejects.toThrow('getAccessToken')
		expect(fetch).not.toHaveBeenCalled()
	})
})
