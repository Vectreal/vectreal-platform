import { createServer } from 'node:http'

import { afterEach, describe, expect, it } from 'vitest'

import { loopbackRedirects, signIn } from './oauth'
import {
	fakeAuthorizationServer,
	freePort,
	type FakeAuthorizationServer
} from './test-support'

let auth: FakeAuthorizationServer | undefined
afterEach(async () => {
	await auth?.close()
	auth = undefined
})

/**
 * Signs in against a fake server, playing the browser: once the authorize URL
 * is shown, it calls the redirect URI with what `respond` returns, or never
 * comes back when `respond` returns null.
 */
async function signInWith(
	respond: (authorize: URL) => Record<string, string> | null,
	options: { redirectUris?: string[]; timeoutMs?: number } = {}
) {
	let challenge: string | undefined
	auth = await fakeAuthorizationServer({ challenge: () => challenge })
	const redirectUris = options.redirectUris ?? [
		`http://127.0.0.1:${await freePort()}/callback`
	]
	const shown: URL[] = []
	const tokens = await signIn({
		origin: 'http://localhost:4200',
		timeoutMs: options.timeoutMs,
		client: {
			client_id: 'cli-client',
			redirect_uris: redirectUris,
			authorization_server: auth.url
		},
		presentUrl: (href) => {
			const authorize = new URL(href)
			shown.push(authorize)
			challenge = authorize.searchParams.get('code_challenge') ?? undefined
			const response = respond(authorize)
			if (!response) return
			const callback = new URL(authorize.searchParams.get('redirect_uri')!)
			for (const [key, value] of Object.entries(response)) {
				callback.searchParams.set(key, value)
			}
			void fetch(callback).catch(() => undefined)
		}
	})
	return { tokens, authorize: shown[0], auth }
}

const approve = (authorize: URL) => ({
	code: 'the-code',
	state: authorize.searchParams.get('state')!
})

describe('signIn', () => {
	it('exchanges the code with the verifier its S256 challenge was made from', async () => {
		const { tokens, authorize, auth } = await signInWith(approve)

		expect(authorize.pathname).toBe('/auth/v1/oauth/authorize')
		expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
			response_type: 'code',
			client_id: 'cli-client',
			code_challenge_method: 'S256',
			resource: 'http://localhost:4200'
		})
		const [exchange] = auth.tokenRequests
		expect(Object.fromEntries(exchange)).toMatchObject({
			grant_type: 'authorization_code',
			client_id: 'cli-client',
			code: 'the-code',
			redirect_uri: authorize.searchParams.get('redirect_uri')
		})
		expect(tokens).toMatchObject({
			accessToken: 'access-1',
			refreshToken: 'refresh-1'
		})
		expect(tokens.expiresAt).toBeGreaterThan(Date.now() + 3_500_000)
	})

	it('refuses a response for another sign-in, and keeps waiting for its own', async () => {
		let challenge: string | undefined
		auth = await fakeAuthorizationServer({ challenge: () => challenge })
		const port = await freePort()
		const strayStatuses: number[] = []

		const tokens = await signIn({
			origin: 'http://localhost:4200',
			client: {
				client_id: 'cli-client',
				redirect_uris: [`http://127.0.0.1:${port}/callback`],
				authorization_server: auth.url
			},
			presentUrl: (href) => {
				const authorize = new URL(href)
				challenge = authorize.searchParams.get('code_challenge') ?? undefined
				const callback = (state: string, code: string) =>
					`http://127.0.0.1:${port}/callback?${new URLSearchParams({ code, state })}`
				// Something else on this machine gets there first.
				void fetch(callback('someone-elses', 'stolen'))
					.then((response) => strayStatuses.push(response.status))
					.then(() =>
						fetch(callback(authorize.searchParams.get('state')!, 'the-code'))
					)
			}
		})

		expect(strayStatuses).toEqual([400])
		expect(tokens.accessToken).toBe('access-1')
		expect(auth.tokenRequests.map((body) => body.get('code'))).toEqual([
			'the-code'
		])
	})

	it('refuses a response from another authorization server', async () => {
		await expect(
			signInWith((authorize) => ({
				...approve(authorize),
				iss: 'https://elsewhere.example'
			}))
		).rejects.toThrow('elsewhere.example')
		expect(auth?.tokenRequests).toHaveLength(0)
	})

	it('accepts the issuer it signed in with', async () => {
		const { tokens } = await signInWith((authorize) => ({
			...approve(authorize),
			iss: auth!.url
		}))
		expect(tokens.accessToken).toBe('access-1')
	})

	it('reports a refusal from the consent page', async () => {
		await expect(
			signInWith((authorize) => ({
				state: authorize.searchParams.get('state')!,
				error: 'access_denied',
				error_description: 'The user denied access'
			}))
		).rejects.toThrow('The user denied access')
	})

	it('listens on the next registered port when the first is taken', async () => {
		const taken = createServer()
		const takenPort = await freePort()
		await new Promise<void>((resolve) =>
			taken.listen(takenPort, '127.0.0.1', resolve)
		)
		try {
			const nextPort = await freePort()
			const { authorize } = await signInWith(approve, {
				redirectUris: [
					`http://127.0.0.1:${takenPort}/callback`,
					`http://127.0.0.1:${nextPort}/callback`
				]
			})
			expect(authorize.searchParams.get('redirect_uri')).toBe(
				`http://127.0.0.1:${nextPort}/callback`
			)
		} finally {
			await new Promise((resolve) => taken.close(resolve))
		}
	})

	it('times out and frees the port', async () => {
		const port = await freePort()
		// The browser never comes back.
		await expect(
			signInWith(() => null, {
				redirectUris: [`http://127.0.0.1:${port}/callback`],
				timeoutMs: 50
			})
		).rejects.toThrow('timed out')
		// The port is free again: something else can listen on it.
		const again = createServer()
		await new Promise<void>((resolve, reject) => {
			again.once('error', reject)
			again.listen(port, '127.0.0.1', resolve)
		})
		await new Promise((resolve) => again.close(resolve))
	})
})

describe('loopbackRedirects', () => {
	it('keeps only http on 127.0.0.1 with a port', () => {
		expect(
			loopbackRedirects([
				'http://127.0.0.1:51730/callback',
				'https://127.0.0.1:51731/callback',
				'http://localhost:51732/callback',
				'http://evil.example:51733/callback',
				'http://127.0.0.1/callback',
				'not a url'
			]).map(String)
		).toEqual(['http://127.0.0.1:51730/callback'])
	})
})
