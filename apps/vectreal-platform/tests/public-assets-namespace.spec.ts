import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `/assets` is Vite's, and only Vite's.
 *
 * Everything under it is served immutable for a year, by `server.mjs` and at
 * Cloudflare's edge, because every file Vite writes there is named for its
 * content. `public/assets` put files into the same URL space that keep their
 * name when their content changes, and a recaptured home screenshot stayed
 * cached on staging for everyone who had seen the old one.
 *
 * A file that should change under a fixed name goes in `public/media`, which
 * is served fresh for five minutes. One that can be imported is imported, and
 * gets a hashed name in `/assets` from Vite.
 */
const APP_ROOT = resolve(import.meta.dirname, '..')
const PUBLIC_DIR = join(APP_ROOT, 'public')
const ARTICLES_DIR = join(APP_ROOT, 'app/routes/news-room-page/articles')

describe('the /assets namespace', () => {
	it('holds nothing from public, so nothing unhashed is cached for a year', () => {
		expect(existsSync(join(PUBLIC_DIR, 'assets'))).toBe(false)
	})

	it('is named by no article, whose images now live under /media', () => {
		const stale = readdirSync(ARTICLES_DIR)
			.filter((file) => file.endsWith('.mdx'))
			.filter((file) =>
				/\/assets\/(images|models)\//.test(
					readFileSync(join(ARTICLES_DIR, file), 'utf8')
				)
			)
		expect(stale).toEqual([])
	})
})
