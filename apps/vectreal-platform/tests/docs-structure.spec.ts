/**
 * The docs' two audiences, and the pages that moved to make them.
 *
 * The docs used to be one reading path that began with contributor setup, so
 * someone who only wanted to try the publisher was sent to clone the repo.
 * Every category now belongs to one of two readers, "In the browser" or "In
 * your code". These hold that, hold the manifest to the routes and files that
 * exist, and hold the old addresses to the pages they became, so a link in a
 * README on npm or in an article still lands.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { isRoute } from './route-patterns'
import {
	DOC_AUDIENCES,
	DOC_CATEGORY_LABELS,
	docsPages,
	type DocCategory
} from '../app/lib/docs/docs-manifest'
import { DOCS_MOVED, loader } from '../app/routes/docs/docs-moved'
import { meta } from '../app/routes/layouts/docs-layout'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function redirectFor(path: string) {
	const response = loader({
		request: new Request(`https://vectreal.test${path}`),
		params: {},
		context: {}
	} as never) as Response
	return { status: response.status, location: response.headers.get('Location') }
}

describe('the docs audiences', () => {
	it('put every category in exactly one audience', () => {
		for (const category of Object.keys(DOC_CATEGORY_LABELS) as DocCategory[]) {
			const holders = DOC_AUDIENCES.filter((audience) =>
				audience.categories.includes(category)
			)
			expect(
				holders.map((audience) => audience.id),
				category
			).toHaveLength(1)
		}
	})

	it('start the browser reader on the publisher walkthrough, not on repo setup', () => {
		const [first] = DOC_AUDIENCES
		expect(first.id).toBe('browser')
		const start = docsPages.find((page) => page.slug === 'getting-started')
		expect(start?.category).toBe(first.categories[0])
		expect(start?.sourcePath).toMatch(/getting-started\/index\.mdx$/)
		// What the page asks of the reader, not only where it is filed.
		const source = readFileSync(resolve(REPO_ROOT, start!.sourcePath), 'utf8')
		expect(source).not.toMatch(/\/docs\/self-hosting|pnpm|dev stack/i)
	})

	it('file the embed SDK with the code, whatever its URL says', () => {
		const sdk = docsPages.find((page) => page.slug === 'guides/embed-sdk')
		const code = DOC_AUDIENCES.find((audience) => audience.id === 'code')
		expect(code?.categories).toContain(sdk?.category)
	})
})

describe('the docs manifest', () => {
	it.each(docsPages.map((page) => [page.slug, page] as const))(
		'%s is a route and has its source file',
		(slug, page) => {
			expect(isRoute(`/docs/${slug}`)).toBe(true)
			expect(existsSync(resolve(REPO_ROOT, page.sourcePath))).toBe(true)
		}
	)
})

describe('the docs pages that moved', () => {
	it.each(Object.entries(DOCS_MOVED))(
		'%s moves permanently to %s, a page that exists',
		(from, to) => {
			expect(isRoute(from)).toBe(true)
			expect(redirectFor(from)).toEqual({ status: 301, location: to })
			expect(docsPages.map((page) => `/docs/${page.slug}`)).toContain(to)
		}
	)

	it('keeps the query string, so tracking on inbound links survives', () => {
		expect(
			redirectFor('/docs/getting-started/installation?utm_source=npm').location
		).toBe('/docs/self-hosting/installation?utm_source=npm')
	})
})

/*
  The trail search engines read, from the page's structured data. It is built
  apart from the one in the bar, and it read the URL too: the embed SDK told
  search engines it was under "Guides", at a /docs/guides that does not exist.
*/
describe('the docs breadcrumb in structured data', () => {
	function trailFor(pathname: string) {
		const tags = meta({ location: { pathname }, matches: [] } as never) as {
			'script:ld+json'?: {
				'@type': string
				itemListElement: { name: string; item?: string }[]
			}
		}[]
		const list = tags.find(
			(tag) => tag['script:ld+json']?.['@type'] === 'BreadcrumbList'
		)?.['script:ld+json']
		return list?.itemListElement.map(({ name, item }) => ({ name, item }))
	}

	it('files a page under its category, not under its URL', () => {
		expect(trailFor('/docs/guides/embed-sdk')?.map(({ name }) => name)).toEqual(
			['Home', 'Docs', 'Embed SDK']
		)
	})

	it('takes the category crumb to its first page', () => {
		const category = trailFor('/docs/packages/viewer')?.[2]
		expect(category?.name).toBe('Packages and SDK')
		expect(category?.item).toMatch(/\/docs\/guides\/embed-sdk$/)
	})
})
