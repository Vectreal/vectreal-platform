/**
 * The Discord invite and the repository are declared once, in the site map's
 * `COMMUNITY`. Code reads them from there. Two kinds of file cannot, and keep a
 * literal this spec holds equal instead:
 *
 * - MDX pages and articles: a markdown link takes no expression, and a JSX
 *   anchor would bypass the MDX components that style links.
 * - `docs-manifest.ts`: `react-router.config.ts` imports it, and the site map
 *   reaches `@vctrl/core` through product-copy, which CI never builds before
 *   the config loads.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { COMMUNITY } from './site-map'
import { GITHUB_REPO } from '../docs/docs-manifest'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../..')

const DISCORD_INVITE = /discord\.gg\/[A-Za-z0-9]+/g
// Owner and repository; the owner alone (the org page) is a different link.
const REPOSITORY = /https:\/\/github\.com\/vectreal\/[A-Za-z0-9-]+/gi

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return sourceFiles(path)
		return /\.(mdx|tsx?)$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)
			? [path]
			: []
	})
}

const files = sourceFiles(APP_DIR).map((path) => ({
	name: relative(APP_DIR, path),
	text: readFileSync(path, 'utf8')
}))

/** Where a literal is allowed: the owner, the config-graph module, and MDX. */
const MAY_HOLD_LITERAL = new Set([
	'constants/product-copy.ts',
	'lib/docs/docs-manifest.ts'
])

describe('community links', () => {
	it('finds the pages that link out', () => {
		expect(
			files.filter(({ name }) => name.endsWith('.mdx')).length
		).toBeGreaterThan(10)
	})

	it('keeps the docs manifest repository equal to the site map', () => {
		expect(GITHUB_REPO).toBe(COMMUNITY.github)
	})

	it.each(files.filter(({ name }) => name.endsWith('.mdx')))(
		'$name links the site map Discord invite and repository',
		({ text }) => {
			for (const invite of text.match(DISCORD_INVITE) ?? []) {
				expect(`https://${invite}`).toBe(COMMUNITY.discord)
			}
			for (const repository of text.match(REPOSITORY) ?? []) {
				expect(repository).toBe(COMMUNITY.github)
			}
		}
	)

	it('reads both from the site map everywhere code can import it', () => {
		const literals = files
			.filter(
				({ name }) => !name.endsWith('.mdx') && !MAY_HOLD_LITERAL.has(name)
			)
			.filter(
				({ text }) => text.match(DISCORD_INVITE) || text.match(REPOSITORY)
			)
			.map(({ name }) => name)
		expect(literals).toEqual([])
	})
})
