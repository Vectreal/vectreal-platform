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

	it('lists the projects with the bearer token and returns what it parsed', async () => {
		const projects = {
			projects: [{ id: 'project-1', name: 'Chairs' }]
		}
		const fetch = respond({ success: true, data: projects })
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'token-1',
			fetch
		})

		await expect(client.projects()).resolves.toEqual(projects)
		expect(sent(fetch).url).toBe('https://vectreal.com/api/v1/projects')
		expect(sent(fetch).headers.get('Authorization')).toBe('Bearer token-1')
	})

	it('creates a project with POST, a JSON body and the key as an RFC 8941 string', async () => {
		const created = { project: { id: 'project-9', name: 'Chairs' } }
		const fetch = respond({ success: true, data: created }, 201)
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'token-1',
			fetch
		})

		await expect(
			client.createProject(
				{ name: 'Chairs' },
				{ idempotencyKey: 'retry "1" \\ a' }
			)
		).resolves.toEqual(created)
		const [url, init] = fetch.mock.calls[0]
		const headers = new Headers(init?.headers)
		expect(String(url)).toBe('https://vectreal.com/api/v1/projects')
		expect(init?.method).toBe('POST')
		expect(headers.get('Authorization')).toBe('Bearer token-1')
		expect(headers.get('Content-Type')).toBe('application/json')
		expect(headers.get('Idempotency-Key')).toBe('"retry \\"1\\" \\\\ a"')
		expect(JSON.parse(String(init?.body))).toEqual({ name: 'Chairs' })
	})

	it('gives each create without a key a fresh one', async () => {
		const fetch = vi.fn<typeof globalThis.fetch>(async () =>
			Response.json(
				{ success: true, data: { project: { id: 'p', name: 'Chairs' } } },
				{ status: 201 }
			)
		)
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'token-1',
			fetch
		})

		await client.createProject({ name: 'Chairs' })
		await client.createProject({ name: 'Chairs' })

		const keys = fetch.mock.calls.map(([, init]) =>
			new Headers(init?.headers).get('Idempotency-Key')
		)
		expect(keys[0]).toMatch(/^"[0-9a-f-]{36}"$/)
		expect(keys[1]).not.toBe(keys[0])
	})

	it.each([
		[409, 'idempotency_in_progress'],
		[422, 'idempotency_key_reused']
	])(
		'surfaces a %i refusal of a create with its code',
		async (status, code) => {
			const fetch = respond({ success: false, error: 'refused', code }, status)
			const client = createVectrealClient({
				baseUrl: 'https://vectreal.com',
				getAccessToken: () => 'token-1',
				fetch
			})

			const error = await client
				.createProject({ name: 'Chairs' }, { idempotencyKey: 'k' })
				.catch((thrown: unknown) => thrown)
			expect(error).toBeInstanceOf(VectrealApiError)
			expect(error).toMatchObject({ status, code })
		}
	)

	it('sends a scene create as multipart with the file, the name and a quoted key', async () => {
		const scene = { scene: { id: 's1', projectId: 'p/1', name: 'Chair' } }
		const fetch = respond({ success: true, data: scene }, 201)
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'token-1',
			fetch
		})
		const file = new Blob([new Uint8Array([1, 2, 3])])

		await expect(
			client.createScene(
				'p/1',
				{ name: 'Chair', file },
				{ idempotencyKey: 'k-1' }
			)
		).resolves.toEqual(scene)
		const [url, init] = fetch.mock.calls[0]
		const headers = new Headers(init?.headers)
		expect(String(url)).toBe(
			'https://vectreal.com/api/v1/projects/p%2F1/scenes'
		)
		expect(init?.method).toBe('POST')
		expect(headers.get('Authorization')).toBe('Bearer token-1')
		// Left to fetch, which writes the multipart boundary.
		expect(headers.has('Content-Type')).toBe(false)
		expect(headers.get('Idempotency-Key')).toBe('"k-1"')
		const form = init?.body as FormData
		expect(form.get('name')).toBe('Chair')
		expect(
			new Uint8Array(await (form.get('file') as Blob).arrayBuffer())
		).toEqual(new Uint8Array([1, 2, 3]))
	})

	it.each([
		[402, 'payment_required'],
		[403, 'insufficient_plan']
	])(
		'surfaces a %i refusal of a scene create with its code',
		async (status, code) => {
			const fetch = respond({ success: false, error: 'refused', code }, status)
			const client = createVectrealClient({
				baseUrl: 'https://vectreal.com',
				getAccessToken: () => 'token-1',
				fetch
			})

			const error = await client
				.createScene('p1', { name: 'Chair', file: new Blob([]) })
				.catch((thrown: unknown) => thrown)
			expect(error).toBeInstanceOf(VectrealApiError)
			expect(error).toMatchObject({ status, code })
		}
	)

	it('publishes a scene as multipart with the file and a quoted key', async () => {
		const publication = {
			publication: {
				sceneId: 's/1',
				status: 'published',
				publishedAt: '2026-10-19T08:00:00.000Z'
			}
		}
		const fetch = respond({ success: true, data: publication })
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'token-1',
			fetch
		})

		await expect(
			client.publishScene(
				's/1',
				{ file: new Blob([new Uint8Array([7])]) },
				{ idempotencyKey: 'k-2' }
			)
		).resolves.toEqual(publication)
		const [url, init] = fetch.mock.calls[0]
		const headers = new Headers(init?.headers)
		expect(String(url)).toBe(
			'https://vectreal.com/api/v1/scenes/s%2F1/publication'
		)
		expect(init?.method).toBe('POST')
		expect(headers.has('Content-Type')).toBe(false)
		expect(headers.get('Idempotency-Key')).toBe('"k-2"')
		expect((init?.body as FormData).get('file')).toBeInstanceOf(Blob)
	})

	it('takes a scene offline with DELETE, no body and a quoted key', async () => {
		const publication = {
			publication: { sceneId: 's1', status: 'draft', publishedAt: null }
		}
		const fetch = respond({ success: true, data: publication })
		const client = createVectrealClient({
			baseUrl: 'https://vectreal.com',
			getAccessToken: () => 'token-1',
			fetch
		})

		await expect(
			client.unpublishScene('s1', { idempotencyKey: 'k-3' })
		).resolves.toEqual(publication)
		const [url, init] = fetch.mock.calls[0]
		expect(String(url)).toBe(
			'https://vectreal.com/api/v1/scenes/s1/publication'
		)
		expect(init?.method).toBe('DELETE')
		expect(init?.body).toBeUndefined()
		expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('"k-3"')
	})

	describe('scene settings', () => {
		const settings = {
			settings: {
				environment: { preset: 'night-city' },
				camera: { activeCameraId: 'default' },
				hotspots: []
			}
		}
		const client = (fetch: typeof globalThis.fetch) =>
			createVectrealClient({
				baseUrl: 'https://vectreal.com',
				getAccessToken: () => 'token-1',
				fetch
			})

		it("lists a project's scenes with GET", async () => {
			const scenes = {
				scenes: [
					{
						id: 's1',
						name: 'Chair',
						status: 'draft',
						updatedAt: '2026-10-20T08:00:00.000Z'
					}
				]
			}
			const fetch = respond({ success: true, data: scenes })

			await expect(client(fetch).listScenes('p 1')).resolves.toEqual(scenes)
			expect(sent(fetch).url).toBe(
				'https://vectreal.com/api/v1/projects/p%201/scenes'
			)
		})

		it("reads a scene's settings with GET", async () => {
			const fetch = respond({ success: true, data: settings })

			await expect(client(fetch).getSceneSettings('s1')).resolves.toEqual(
				settings
			)
			expect(sent(fetch).url).toBe(
				'https://vectreal.com/api/v1/scenes/s1/settings'
			)
		})

		it('changes settings with PATCH, a JSON body and a quoted key', async () => {
			const fetch = respond({ success: true, data: settings })

			await expect(
				client(fetch).updateSceneSettings(
					's1',
					{ environment: { preset: 'night-city' } },
					{ idempotencyKey: 'k-4' }
				)
			).resolves.toEqual(settings)
			const [url, init] = fetch.mock.calls[0]
			expect(String(url)).toBe('https://vectreal.com/api/v1/scenes/s1/settings')
			expect(init?.method).toBe('PATCH')
			expect(JSON.parse(String(init?.body))).toEqual({
				environment: { preset: 'night-city' }
			})
			const headers = new Headers(init?.headers)
			expect(headers.get('Content-Type')).toBe('application/json')
			expect(headers.get('Idempotency-Key')).toBe('"k-4"')
		})
	})

	describe('embeds', () => {
		const embedKey = {
			id: 'k1',
			name: 'Shop',
			keyPreview: 'abcd',
			expiresAt: '2027-01-17T00:00:00.000Z',
			lastUsedAt: null,
			revoked: false,
			expired: false,
			usable: true
		}
		const clientFor = (fetch: ReturnType<typeof respond>) =>
			createVectrealClient({
				baseUrl: 'https://vectreal.com',
				getAccessToken: () => 'token-1',
				fetch
			})

		it("lists a project's embed keys with GET", async () => {
			const fetch = respond({ success: true, data: { embedKeys: [embedKey] } })

			await expect(clientFor(fetch).listEmbedKeys('p 1')).resolves.toEqual({
				embedKeys: [embedKey]
			})
			const [url, init] = fetch.mock.calls[0]
			expect(String(url)).toBe(
				'https://vectreal.com/api/v1/projects/p%201/embed-keys'
			)
			expect(init?.method).toBe('GET')
		})

		it('creates an embed key with POST, a JSON body and a quoted key', async () => {
			const fetch = respond({ success: true, data: { embedKey } }, 201)

			await expect(
				clientFor(fetch).createEmbedKey(
					'p1',
					{ name: 'Shop' },
					{ idempotencyKey: 'k-4' }
				)
			).resolves.toEqual({ embedKey })
			const [url, init] = fetch.mock.calls[0]
			expect(String(url)).toBe(
				'https://vectreal.com/api/v1/projects/p1/embed-keys'
			)
			expect(init?.method).toBe('POST')
			expect(JSON.parse(String(init?.body))).toEqual({ name: 'Shop' })
			expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('"k-4"')
		})

		it('reads and replaces allowed domains with GET and PUT', async () => {
			const domains = { allowedDomains: ['example.com'] }
			const getFetch = respond({ success: true, data: domains })
			const putFetch = respond({ success: true, data: domains })

			await expect(
				clientFor(getFetch).getAllowedDomains('p1')
			).resolves.toEqual(domains)
			await expect(
				clientFor(putFetch).setAllowedDomains(
					'p1',
					{ domains: ['example.com'] },
					{ idempotencyKey: 'k-5' }
				)
			).resolves.toEqual(domains)

			const url = 'https://vectreal.com/api/v1/projects/p1/allowed-domains'
			expect(String(getFetch.mock.calls[0][0])).toBe(url)
			const [putUrl, init] = putFetch.mock.calls[0]
			expect(String(putUrl)).toBe(url)
			expect(init?.method).toBe('PUT')
			expect(JSON.parse(String(init?.body))).toEqual({
				domains: ['example.com']
			})
			expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('"k-5"')
		})

		it('asks for a scene embed, naming the key only when given', async () => {
			const embed = {
				embed: {
					projectId: 'p1',
					keyId: 'k1',
					url: 'https://vectreal.com/embed/p1/s1?token=t',
					iframeSnippet: '<iframe></iframe>',
					sdkSnippet: '<script></script>',
					previewUrl: 'https://vectreal.com/preview/p1/s1',
					allowedDomains: []
				}
			}
			const bare = respond({ success: true, data: embed })
			const named = respond({ success: true, data: embed })

			await expect(clientFor(bare).getSceneEmbed('s1')).resolves.toEqual(embed)
			await clientFor(named).getSceneEmbed('s1', { keyId: 'k 1' })

			expect(String(bare.mock.calls[0][0])).toBe(
				'https://vectreal.com/api/v1/scenes/s1/embed'
			)
			expect(String(named.mock.calls[0][0])).toBe(
				'https://vectreal.com/api/v1/scenes/s1/embed?keyId=k+1'
			)
		})
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
			fetch: respond(
				{ success: false, error: 'Invalid token', code: 'invalid_token' },
				401
			)
		})

		const error = await client.me().catch((caught: unknown) => caught)
		expect(error).toBeInstanceOf(VectrealApiError)
		expect(error).not.toBeInstanceOf(VectrealContractError)
		expect(error).toMatchObject({
			status: 401,
			message: 'Invalid token',
			code: 'invalid_token'
		})
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

		const error = await client.me().catch((caught: unknown) => caught)
		expect(error).toMatchObject({
			name: 'VectrealApiError',
			status: 403,
			message: 'Project limit reached',
			body: refusal
		})
		// A code this client has no entry for still reaches the caller.
		expect((error as VectrealApiError).code).toBe('quota_exceeded')
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
