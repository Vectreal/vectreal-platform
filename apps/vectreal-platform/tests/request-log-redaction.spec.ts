/**
 * An embed authenticates with `?token=` because an iframe cannot set a header,
 * so the URL the production server logs for an embed request carries a live
 * key. The request log is a sink like PostHog and the error report, and gets
 * the same redaction.
 *
 * Through the real Express app, because the log line is written by morgan
 * after the response finishes: a test of `redactUrlSecrets` alone says nothing
 * about whether the server calls it.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import * as entryServer from '../app/entry.server'
import { redactUrlSecrets } from '../app/lib/posthog/redact-url-secrets'
// @ts-expect-error -- plain JavaScript, run by Node directly in production.
import { createServerApp } from '../server-app.mjs'

import type { Server } from 'node:http'

let clientDir: string
let server: Server
let origin: string

beforeAll(async () => {
	clientDir = mkdtempSync(join(tmpdir(), 'request-log-redaction-'))
	const app = createServerApp({
		clientDir,
		// Stands in for React Router.
		handleRequest: (_req: unknown, res: { send(body: string): void }) => {
			res.send('app')
		},
		isUnpublishedNewsPath: () => false,
		redactUrlSecrets
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

async function logLineFor(path: string): Promise<string> {
	const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
	try {
		await (await fetch(`${origin}${path}`)).text()
		// Morgan writes once the response has finished, after fetch resolves.
		await vi.waitFor(() =>
			expect(
				write.mock.calls.some(([chunk]) => String(chunk).startsWith('GET '))
			).toBe(true)
		)
		return write.mock.calls
			.map(([chunk]) => String(chunk))
			.find((chunk) => chunk.startsWith('GET ')) as string
	} finally {
		write.mockRestore()
	}
}

describe('the request log', () => {
	it("redacts an embed's token and keeps the rest of the line", async () => {
		const line = await logLineFor(
			'/embed/project-1/scene-1?token=vctrl_live_secret&autoplay=1'
		)

		expect(line).not.toContain('vctrl_live_secret')
		expect(line).toMatch(
			/^GET \/embed\/project-1\/scene-1\?token=redacted&autoplay=1 200 \d+ - [\d.]+ ms\n$/
		)
	})

	it('logs a URL without a token as it is', async () => {
		const line = await logLineFor('/about?ref=news')

		expect(line).toMatch(/^GET \/about\?ref=news 200 /)
	})
})

describe('the server build', () => {
	it('exports the redaction server.mjs passes to the request log', () => {
		// `server.mjs` reads it from `build.entry.module` and refuses to start
		// without it.
		expect(entryServer.redactUrlSecrets).toBe(redactUrlSecrets)
	})
})
