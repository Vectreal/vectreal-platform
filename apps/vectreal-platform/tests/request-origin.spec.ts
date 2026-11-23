/**
 * React Router builds each request's URL from `req.protocol` and
 * `req.hostname` (`@react-router/express`), and from 8.3.1 refuses an action
 * whose `Origin` differs from that URL's origin in scheme, host or port. Fly's
 * proxy terminates TLS, so the scheme has to come from its
 * `X-Forwarded-Proto` or every action on a deployed app answers 400.
 *
 * Through the real Express app, with the handler reporting what the adapter
 * reads.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// @ts-expect-error -- plain JavaScript, run by Node directly in production.
import { createServerApp } from '../server-app.mjs'

import type { Server } from 'node:http'

let clientDir: string
let server: Server
let origin: string

beforeAll(async () => {
	clientDir = mkdtempSync(join(tmpdir(), 'request-origin-'))
	const app = createServerApp({
		clientDir,
		// Stands in for React Router: what `createRemixRequest` builds the URL from.
		handleRequest: (
			req: {
				protocol: string
				hostname: string
				get(name: string): string | undefined
			},
			res: { send(body: string): void }
		) => {
			// The adapter also takes the port from X-Forwarded-Host once the
			// proxy is trusted, so the header must not reach it at all.
			const forwardedHost = req.get('X-Forwarded-Host')
			res.send(
				`${req.protocol}://${req.hostname}${forwardedHost ? ` via ${forwardedHost}` : ''}`
			)
		},
		isUnpublishedNewsPath: () => false,
		redactUrlSecrets: (url: string) => url
	})
	server = await new Promise<Server>((resolve) => {
		const listening: Server = app.listen(0, () => resolve(listening))
	})
	const address = server.address()
	origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
})

afterAll(() => {
	server?.close()
	rmSync(clientDir, { recursive: true, force: true })
})

async function requestOrigin(headers: Record<string, string> = {}) {
	return (await fetch(`${origin}/contact`, { method: 'POST', headers })).text()
}

describe('the origin a request reaches React Router with', () => {
	it("takes the scheme from the proxy's X-Forwarded-Proto", async () => {
		expect(await requestOrigin({ 'X-Forwarded-Proto': 'https' })).toBe(
			'https://127.0.0.1'
		)
	})

	it('is the connection scheme without a proxy', async () => {
		expect(await requestOrigin()).toBe('http://127.0.0.1')
	})

	it('keeps the Host header when a client sends X-Forwarded-Host', async () => {
		expect(
			await requestOrigin({
				'X-Forwarded-Proto': 'https',
				'X-Forwarded-Host': 'evil.example:8443'
			})
		).toBe('https://127.0.0.1')
	})

	it('ignores an X-Forwarded-Proto that is not a scheme', async () => {
		expect(await requestOrigin({ 'X-Forwarded-Proto': 'a b' })).toBe(
			'http://127.0.0.1'
		)
	})
})
