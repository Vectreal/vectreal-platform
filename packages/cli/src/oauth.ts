import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'

import { z } from 'zod'

import type { CliClient } from '@vctrl/sdk'

const tokenResponseSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string(),
	expires_in: z.number()
})

const tokenErrorSchema = z.object({
	error: z.string().optional(),
	error_description: z.string().optional(),
	msg: z.string().optional()
})

export interface TokenSet {
	accessToken: string
	refreshToken: string
	/** When the access token lapses, in ms since the epoch. */
	expiresAt: number
}

/** The authorization server refused a refresh: the grant or session is gone. */
export class RefreshRefusedError extends Error {
	override readonly name = 'RefreshRefusedError'
}

/** Sign-in did not complete: refused, mismatched, timed out or unreachable. */
export class SignInError extends Error {
	override readonly name = 'SignInError'
}

/**
 * The redirect URIs the CLI may listen on: plain http on 127.0.0.1 with a
 * port. Anything else in the list is for another client and never listened on.
 */
export function loopbackRedirects(redirectUris: readonly string[]): URL[] {
	return redirectUris.flatMap((uri) => {
		try {
			const url = new URL(uri)
			return url.protocol === 'http:' &&
				url.hostname === '127.0.0.1' &&
				url.port !== ''
				? [url]
				: []
		} catch {
			return []
		}
	})
}

async function listenOnFirstFree(
	candidates: URL[]
): Promise<{ server: Server; redirect: URL }> {
	for (const redirect of candidates) {
		const server = createServer()
		const listening = await new Promise<boolean>((resolve) => {
			server.once('error', () => resolve(false))
			server.listen(Number(redirect.port), '127.0.0.1', () => resolve(true))
		})
		if (listening) return { server, redirect }
	}
	throw new SignInError(
		candidates.length === 0
			? 'This server registers no loopback redirect for the CLI.'
			: `Ports ${candidates.map((url) => url.port).join(', ')} are all in use; free one and run vectreal login again.`
	)
}

/** PKCE: a verifier, and its S256 challenge. */
export function createPkce(): { verifier: string; challenge: string } {
	const verifier = randomBytes(32).toString('base64url')
	const challenge = createHash('sha256').update(verifier).digest('base64url')
	return { verifier, challenge }
}

/**
 * Waits for the browser to come back to the redirect URI and returns the code.
 * Refuses a response for a different sign-in (`state`), or from a different
 * authorization server (`iss`, checked when the server sends it).
 */
function awaitCallback(
	server: Server,
	redirect: URL,
	expected: { state: string; issuer: string },
	timeoutMs: number
): Promise<string> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() =>
				reject(new SignInError('Sign-in timed out; run vectreal login again.')),
			timeoutMs
		)
		server.on('request', (request, response) => {
			const url = new URL(request.url ?? '/', redirect)
			if (request.method !== 'GET' || url.pathname !== redirect.pathname) {
				response.writeHead(404).end()
				return
			}
			const finish = (status: number, page: string, outcome: () => void) => {
				clearTimeout(timer)
				response
					.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
					.end(page)
				outcome()
			}
			const params = url.searchParams
			// Not this sign-in's response: refused, and the wait goes on. Ending
			// the sign-in here would let any local process or page that can reach
			// loopback cancel it with one request.
			if (params.get('state') !== expected.state) {
				response
					.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
					.end('This sign-in was not started here. Close this tab.')
				return
			}
			const issuer = params.get('iss')
			if (issuer !== null && issuer !== expected.issuer) {
				finish(400, 'Unexpected authorization server. Close this tab.', () =>
					reject(
						new SignInError(
							`The response came from ${issuer}, not ${expected.issuer}.`
						)
					)
				)
				return
			}
			const error = params.get('error')
			const code = params.get('code')
			if (error || !code) {
				const reason =
					params.get('error_description') ?? error ?? 'no code returned'
				finish(400, `Sign-in did not complete: ${reason}`, () =>
					reject(new SignInError(`Sign-in did not complete: ${reason}`))
				)
				return
			}
			finish(200, 'Signed in. You can close this tab.', () => resolve(code))
		})
	})
}

async function postToken(
	authorizationServer: string,
	body: Record<string, string>,
	fetchImpl: typeof fetch
): Promise<{ status: number; tokens?: TokenSet; reason: string }> {
	const response = await fetchImpl(`${authorizationServer}/oauth/token`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Accept: 'application/json'
		},
		body: new URLSearchParams(body)
	})
	const json: unknown = await response.json().catch(() => undefined)
	const tokens = tokenResponseSchema.safeParse(json)
	if (response.ok && tokens.success) {
		return {
			status: response.status,
			reason: '',
			tokens: {
				accessToken: tokens.data.access_token,
				refreshToken: tokens.data.refresh_token,
				expiresAt: Date.now() + tokens.data.expires_in * 1000
			}
		}
	}
	const failure = tokenErrorSchema.safeParse(json)
	const detail = failure.success
		? (failure.data.error_description ?? failure.data.msg ?? failure.data.error)
		: undefined
	return {
		status: response.status,
		reason: detail ?? `the token endpoint answered ${response.status}`
	}
}

export interface SignInOptions {
	client: CliClient
	/** The Vectreal origin the token is for (RFC 8707 `resource`). */
	origin: string
	/** Shows the authorize URL to the user; opens a browser unless told not to. */
	presentUrl: (url: string) => void
	timeoutMs?: number
	fetch?: typeof fetch
}

/** OAuth 2.1 authorization code with PKCE, on a loopback redirect. */
export async function signIn({
	client,
	origin,
	presentUrl,
	timeoutMs = 5 * 60_000,
	fetch: fetchImpl = globalThis.fetch
}: SignInOptions): Promise<TokenSet> {
	const { server, redirect } = await listenOnFirstFree(
		loopbackRedirects(client.redirect_uris)
	)
	try {
		const { verifier, challenge } = createPkce()
		const state = randomBytes(16).toString('base64url')
		const redirectUri = redirect.href
		const authorize = new URL(`${client.authorization_server}/oauth/authorize`)
		authorize.search = new URLSearchParams({
			response_type: 'code',
			client_id: client.client_id,
			redirect_uri: redirectUri,
			code_challenge: challenge,
			code_challenge_method: 'S256',
			state,
			resource: origin
		}).toString()

		const code = awaitCallback(
			server,
			redirect,
			{ state, issuer: client.authorization_server },
			timeoutMs
		)
		presentUrl(authorize.href)

		const exchanged = await postToken(
			client.authorization_server,
			{
				grant_type: 'authorization_code',
				client_id: client.client_id,
				code: await code,
				code_verifier: verifier,
				redirect_uri: redirectUri
			},
			fetchImpl
		)
		if (!exchanged.tokens) {
			throw new SignInError(`Could not finish signing in: ${exchanged.reason}`)
		}
		return exchanged.tokens
	} finally {
		// The browser keeps its connection alive, which would hold the process open.
		server.close()
		server.closeAllConnections()
	}
}

/**
 * Trades the refresh token for a new pair. Refresh tokens rotate, so the
 * caller must keep the new one. A 4xx means the grant or session is gone.
 */
export async function refreshTokens(
	{
		authorizationServer,
		clientId,
		refreshToken
	}: { authorizationServer: string; clientId: string; refreshToken: string },
	fetchImpl: typeof fetch = globalThis.fetch
): Promise<TokenSet> {
	const refreshed = await postToken(
		authorizationServer,
		{
			grant_type: 'refresh_token',
			client_id: clientId,
			refresh_token: refreshToken
		},
		fetchImpl
	)
	if (refreshed.tokens) return refreshed.tokens
	// 400 is the grant refused (invalid_grant; Supabase: refresh_token_not_found),
	// 401 the client. A 429, 408 or a gateway's 403 says nothing about the grant.
	if (refreshed.status === 400 || refreshed.status === 401) {
		throw new RefreshRefusedError(refreshed.reason)
	}
	throw new Error(`Could not refresh the session: ${refreshed.reason}`)
}
