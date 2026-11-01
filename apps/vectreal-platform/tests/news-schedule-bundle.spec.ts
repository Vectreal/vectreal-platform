/**
 * What every visitor's browser receives must not name a scheduled article:
 * the route list (`routeDiscovery: initial` sends all of it) and the article
 * body table and chunk names. These pin the two places that used to.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { matchRoutes, type RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'

import {
	isArticleBodyChunkPath,
	newsArticleBodiesPlugin,
	newsArticleChunkFileNames,
	newsBodyId
} from '../app/lib/news/news-body-chunks'
import { getPublishedNewsArticles } from '../app/lib/news/news-manifest.server'
import routes from '../app/routes'

import type { RouteConfigEntry } from '@react-router/dev/routes'
import type { Rolldown } from 'vite'

const ARTICLES = join(__dirname, '../app/routes/news-room-page/articles')
const files = readdirSync(ARTICLES).filter((file) => file.endsWith('.mdx'))
const stems = files.map((file) => file.replace(/\.mdx$/, '').toLowerCase())
const slugs = getPublishedNewsArticles(Number.MAX_SAFE_INTEGER).map(
	({ slug }) => slug
)

function flatten(entries: RouteConfigEntry[]): RouteConfigEntry[] {
	return entries.flatMap((entry) => [entry, ...flatten(entry.children ?? [])])
}

// Route config entries carry everything `matchRoutes` reads.
const matchable = routes as unknown as RouteObject[]

describe('the route list', () => {
	const all = flatten(routes)

	it('names no article, in a path or an id', () => {
		const text = all
			.map(({ path, id }) => `${path ?? ''} ${id ?? ''}`)
			.join('\n')
		expect(slugs.length).toBeGreaterThan(0)
		for (const slug of slugs) expect(text, slug).not.toContain(slug)
	})

	it('answers every article twin with the one markdown route, and the page with the page', () => {
		for (const slug of slugs) {
			const twin = matchRoutes(matchable, `/news-room/${slug}.md`)?.at(-1)
			expect(twin?.route.id, slug).toBe('markdown-twin:news-room')
			expect(twin?.params.slug).toBe(slug)

			const page = matchRoutes(matchable, `/news-room/${slug}`)?.at(-1)
			expect((page?.route as RouteConfigEntry | undefined)?.file, slug).toBe(
				'./routes/news-room-page/news-room-article-page.tsx'
			)
		}
	})
})

describe('article body chunks', () => {
	it('keys the body table by opaque id, never a file name', async () => {
		const plugin = newsArticleBodiesPlugin()
		const resolveId = plugin.resolveId as (id: string) => string | null
		const load = plugin.load as (id: string) => string | null
		const resolved = resolveId('virtual:news-article-bodies')!
		const source = load(resolved)!

		const keys = [...source.matchAll(/^"([0-9a-f]{8})": /gm)].map(
			([, key]) => key
		)
		expect(keys.sort()).toEqual(files.map(newsBodyId).sort())
		// Each import names its file, which bundling turns into the chunk path.
		// Only the keys survive into the page chunk as written.
		for (const key of keys) {
			for (const stem of stems) expect(key).not.toContain(stem)
		}
	})

	it('names an article chunk after its id and leaves every other chunk alone', () => {
		const chunk = (facadeModuleId: string | null) =>
			newsArticleChunkFileNames({ facadeModuleId } as Rolldown.PreRenderedChunk)

		const file = files[0]
		expect(chunk(join(ARTICLES, file))).toBe(
			`assets/news-body-${newsBodyId(file)}-[hash].js`
		)
		expect(chunk(join(ARTICLES, '..', 'news-room-page.tsx'))).toBe(
			'assets/[name]-[hash].js'
		)
		expect(chunk(`${join(ARTICLES, file)}?markdown`)).toBe(
			'assets/[name]-[hash].js'
		)
		expect(chunk(null)).toBe('assets/[name]-[hash].js')
	})

	it('matches the chunk the gate withholds by that name only', () => {
		const id = newsBodyId(files[0])
		expect(isArticleBodyChunkPath(id, `/assets/news-body-${id}-ab_3.js`)).toBe(
			true
		)
		expect(isArticleBodyChunkPath(id, `/assets/news-body-${id}-ab_3.css`)).toBe(
			false
		)
		expect(
			isArticleBodyChunkPath(id, `/assets/news-body-${id}-x/ab_3.js`)
		).toBe(false)
		expect(isArticleBodyChunkPath(id, `/assets/${stems[0]}-ab_3.js`)).toBe(
			false
		)
	})
})
