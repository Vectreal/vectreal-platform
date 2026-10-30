/**
 * The build half of scheduled articles: what the prerender is given, and the
 * two pieces of wiring between the app and `server.mjs` that no request-level
 * test reaches.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import * as entryServer from '../app/entry.server'
import { isUnpublishedNewsPath } from '../app/lib/news/news-manifest.server'
import { getNewsPrerenderPaths } from '../app/lib/news/news-prerender-paths'

describe('getNewsPrerenderPaths', () => {
	const directory = mkdtempSync(join(tmpdir(), 'news-prerender-'))
	const article = (fields: string) =>
		`---\ntitle: "T"\n${fields}\n---\n\nBody\n`

	writeFileSync(
		join(directory, '01_live.mdx'),
		article('slug: "live"\npublishedAt: "2020-01-01"')
	)
	writeFileSync(
		join(directory, '02_scheduled.mdx'),
		article('slug: "far-future"\npublishedAt: "2999-01-01T09:00"')
	)
	writeFileSync(
		join(directory, '03_draft.mdx'),
		article('publishedAt: "2020-01-01"\ndraft: true')
	)

	afterAll(() => rmSync(directory, { recursive: true, force: true }))

	it('prerenders scheduled articles with the rest, and leaves drafts out', () => {
		expect(getNewsPrerenderPaths(directory).sort()).toEqual([
			'/news-room/far-future',
			'/news-room/live'
		])
	})

	it('does not prerender the index, which lists per request', () => {
		expect(getNewsPrerenderPaths(directory)).not.toContain('/news-room')
		expect(getNewsPrerenderPaths()).not.toContain('/news-room')
	})
})

describe("React Router's prerender marker", () => {
	it('is still set by the installed @react-router/dev', () => {
		// `isPrerenderRequest` in the news manifest reads it. Without it the
		// prerender of a scheduled article answers 404 and the build fails.
		const require = createRequire(import.meta.url)
		const dist = dirname(require.resolve('@react-router/dev/vite'))
		expect(readFileSync(join(dist, 'vite.js'), 'utf8')).toContain(
			'process.env.IS_RR_BUILD_REQUEST = "yes"'
		)
	})
})

describe('entry.server', () => {
	it("sends the app's own 404 for an article with no-store, so the edge never keeps it", () => {
		// The gate hands a withheld article to the app; this is the header the
		// document and `.data` 404 leave with (`server-app.mjs`).
		for (const path of [
			'/news-room/a-scheduled-one',
			'/news-room/a-scheduled-one.data'
		]) {
			const response = entryServer.handleDataRequest(
				new Response(null, { status: 404 }),
				{ request: new Request(`https://vectreal.com${path}`) } as Parameters<
					typeof entryServer.handleDataRequest
				>[1]
			)
			expect(response.headers.get('Cache-Control'), path).toBe('no-store')
		}
	})

	it('exports the gate server.mjs reads from the server build', () => {
		expect((entryServer as Record<string, unknown>).isUnpublishedNewsPath).toBe(
			isUnpublishedNewsPath
		)
	})
})
