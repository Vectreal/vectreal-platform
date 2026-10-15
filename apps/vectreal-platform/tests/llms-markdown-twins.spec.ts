import { describe, expect, it } from 'vitest'

import { docsPages } from '../app/lib/docs/docs-manifest'
import { getDocMarkdown } from '../app/lib/markdown/page-markdown.server'
import { getNewsArticles } from '../app/lib/news/news-manifest.server'
import routes from '../app/routes'

const ORIGIN = 'https://vectreal.com'

async function load(route: 'llms' | 'llms-full') {
	const { loader } =
		route === 'llms'
			? await import('../app/routes/llms[.]txt')
			: await import('../app/routes/llms-full[.]txt')
	return loader().text()
}

describe('/llms.txt links the markdown twins', () => {
	it('points every docs page at its twin', async () => {
		const body = await load('llms')
		for (const page of docsPages) {
			expect(body).toContain(`](${ORIGIN}/docs/${page.slug}.md)`)
		}
	})

	it('points every published article at its twin', async () => {
		const body = await load('llms')
		for (const article of getNewsArticles().filter((a) => !a.draft)) {
			expect(body).toContain(`](${ORIGIN}/news-room/${article.slug}.md)`)
		}
	})

	it('links only twins the route table actually serves', async () => {
		const served = new Set(routes.map((route) => `/${route.path}`))
		const linked = [
			...(await load('llms')).matchAll(
				/\]\(https:\/\/vectreal\.com(\/[^)]+\.md)\)/g
			)
		].map((match) => match[1])

		expect(linked.length).toBeGreaterThan(docsPages.length)
		expect(linked.filter((path) => !served.has(path))).toEqual([])
	})

	it('names the one-file version', async () => {
		expect(await load('llms')).toContain(`${ORIGIN}/llms-full.txt`)
	})

	it('links the canonical site, whoever asks', async () => {
		const { loader } = await import('../app/routes/llms[.]txt')
		// The request Express sees on staging: proxy-stripped scheme, staging host.
		const body = await (loader as (args: unknown) => Response)({
			request: new Request('http://staging.vectreal.com/llms.txt')
		}).text()
		const origins = new Set(
			[...body.matchAll(/https?:\/\/(?:[\w-]+\.)*vectreal\.com\b/g)].map(
				(match) => match[0]
			)
		)

		expect([...origins]).toEqual([ORIGIN])
	})
})

describe('/llms-full.txt', () => {
	it('says where each page came from on the canonical site, whoever asks', async () => {
		const { loader } = await import('../app/routes/llms-full[.]txt')
		const body = await loader().text()
		expect(body).not.toMatch(/Source: (?!https:\/\/vectreal\.com\/)/)
	})

	it('carries every docs page, in manifest order, under its source URL', async () => {
		const body = await load('llms-full')
		const positions = docsPages.map((page) =>
			body.indexOf(`Source: ${ORIGIN}/docs/${page.slug}\n`)
		)

		expect(positions.every((position) => position >= 0)).toBe(true)
		expect(positions).toEqual([...positions].sort((a, b) => a - b))
	})

	it('is the twins themselves, not a summary of them', async () => {
		const body = await load('llms-full')
		for (const page of docsPages) {
			expect(body).toContain(getDocMarkdown(page.slug)?.trim())
		}
	})
})
