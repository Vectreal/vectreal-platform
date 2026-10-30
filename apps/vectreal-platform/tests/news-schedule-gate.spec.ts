/**
 * A scheduled article must not leak on production before its `publishedAt`,
 * through any surface: the prerendered HTML and its `.data` payload (both
 * static files, guarded by the server gate), the article loader that answers
 * when the gate hands a request to the app, the markdown twin, the index, the
 * sitemap and `llms.txt`. On staging it is reachable and listed early, and on
 * production it appears on its own once the time passes.
 *
 * The newest real article stands in for a scheduled one: the clock is set a
 * minute before its `publishedAt`, which makes it scheduled with every other
 * article already published.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest'

import {
	getNewsArticles,
	getPublishedNewsArticles,
	isUnpublishedNewsPath
} from '../app/lib/news/news-manifest.server'
import { resolvePublishedAt } from '../app/lib/news/news-schedule'
// @ts-expect-error -- plain JavaScript, run by Node directly in production.
import { createServerApp } from '../server-app.mjs'

import type { NewsArticle } from '../app/lib/news/news-article'
import type { Server } from 'node:http'

const [scheduled, published] = getPublishedNewsArticles()
const BEFORE = resolvePublishedAt(scheduled.publishedAt) - 60_000
const AFTER = resolvePublishedAt(scheduled.publishedAt) + 60_000

// What Vite names the lazy chunk holding an article's compiled body.
const bodyChunk = ({ sourcePath }: NewsArticle) =>
	`/assets/${sourcePath.slice(sourcePath.lastIndexOf('/') + 1, -'.mdx'.length)}-Ab_3-xYz.js`

const PRODUCTION = 'https://vectreal.com'
const STAGING = 'https://staging.vectreal.com'

function deployAs(applicationUrl: string, now: number) {
	vi.stubEnv('DEV', false)
	vi.stubEnv('IS_RR_BUILD_REQUEST', '')
	vi.stubEnv('APPLICATION_URL', applicationUrl)
	vi.setSystemTime(now)
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllEnvs()
})

const slugs = (articles: NewsArticle[]) => articles.map(({ slug }) => slug)

describe('the stand-in article', () => {
	it('is newer than every other, so the clock makes it the only scheduled one', () => {
		expect(resolvePublishedAt(published.publishedAt)).toBeLessThan(BEFORE)
	})
})

describe('which articles a deployment shows', () => {
	it('hides a scheduled article on production until its time', () => {
		deployAs(PRODUCTION, BEFORE)
		expect(slugs(getNewsArticles())).not.toContain(scheduled.slug)
		expect(slugs(getNewsArticles())).toContain(published.slug)

		deployAs(PRODUCTION, AFTER)
		expect(slugs(getNewsArticles())).toContain(scheduled.slug)
	})

	it('shows a scheduled article on staging before its time', () => {
		deployAs(STAGING, BEFORE)
		expect(slugs(getNewsArticles())).toContain(scheduled.slug)
	})

	it('shows a scheduled article to the prerender, which renders every page', () => {
		deployAs(PRODUCTION, BEFORE)
		vi.stubEnv('IS_RR_BUILD_REQUEST', 'yes')
		expect(slugs(getNewsArticles())).toContain(scheduled.slug)
	})

	it('counts an unreadable APPLICATION_URL as production, so it hides', () => {
		deployAs('not a url', BEFORE)
		expect(slugs(getNewsArticles())).not.toContain(scheduled.slug)
	})
})

describe('isUnpublishedNewsPath', () => {
	const spellings = [
		`/news-room/${scheduled.slug}`,
		`/news-room/${scheduled.slug}/`,
		`/news-room/${scheduled.slug}/index.html`,
		`/news-room/${scheduled.slug}.data`,
		`/news-room/${scheduled.slug}.md`,
		bodyChunk(scheduled),
		`/assets/./${encodeURIComponent(bodyChunk(scheduled).slice('/assets/'.length))}`,
		...[scheduled.coverImage, scheduled.sceneImage].filter(
			(image): image is string => Boolean(image)
		)
	]

	it.each(spellings)('withholds %s on production before the time', (path) => {
		deployAs(PRODUCTION, BEFORE)
		expect(isUnpublishedNewsPath(path)).toBe(true)
	})

	it.each(spellings)(
		'lets %s through on staging and after the time',
		(path) => {
			deployAs(STAGING, BEFORE)
			expect(isUnpublishedNewsPath(path)).toBe(false)
			deployAs(PRODUCTION, AFTER)
			expect(isUnpublishedNewsPath(path)).toBe(false)
		}
	)

	it('never withholds a published article or a path that is no article', () => {
		deployAs(PRODUCTION, BEFORE)
		expect(isUnpublishedNewsPath(`/news-room/${published.slug}`)).toBe(false)
		expect(isUnpublishedNewsPath('/news-room')).toBe(false)
		expect(isUnpublishedNewsPath('/news-room/not-an-article')).toBe(false)
		expect(isUnpublishedNewsPath(bodyChunk(published))).toBe(false)
		expect(isUnpublishedNewsPath(`${bodyChunk(scheduled)}.css`)).toBe(false)
		expect(isUnpublishedNewsPath(published.coverImage ?? '/media/x.webp')).toBe(
			false
		)
	})

	it('needs the stand-in to name its og image, or the image case proves nothing', () => {
		expect(scheduled.coverImage).toMatch(/^\/media\//)
	})
})

describe('the server gate, in front of the prerendered files', () => {
	let clientDir: string
	let server: Server
	let origin: string
	const appHandled: string[] = []

	beforeAll(async () => {
		clientDir = mkdtempSync(join(tmpdir(), 'news-schedule-gate-'))
		for (const { slug } of [scheduled, published]) {
			mkdirSync(join(clientDir, 'news-room', slug), { recursive: true })
			writeFileSync(
				join(clientDir, 'news-room', slug, 'index.html'),
				`prerendered ${slug}`
			)
			writeFileSync(
				join(clientDir, 'news-room', `${slug}.data`),
				`data ${slug}`
			)
		}
		for (const article of [scheduled, published]) {
			mkdirSync(join(clientDir, 'assets'), { recursive: true })
			writeFileSync(join(clientDir, bodyChunk(article)), `body ${article.slug}`)
			if (article.coverImage) {
				mkdirSync(join(clientDir, article.coverImage, '..'), {
					recursive: true
				})
				writeFileSync(join(clientDir, article.coverImage), 'image')
			}
		}

		const app = createServerApp({
			clientDir,
			// Stands in for React Router, which renders its 404 here.
			handleRequest: (
				req: { url: string },
				res: {
					status(code: number): {
						set(name: string, value: string): { send(body: string): void }
					}
				}
			) => {
				appHandled.push(req.url)
				res.status(404).set('Cache-Control', 'no-store').send('app')
			},
			isUnpublishedNewsPath
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

	beforeEach(() => {
		appHandled.length = 0
	})

	const fetchPath = (path: string) => fetch(`${origin}${path}`)

	const article = (slug: string) =>
		slug === scheduled.slug ? scheduled : published

	const fileSpellings = (slug: string) => [
		`/news-room/${slug}`,
		`/news-room/${slug}/`,
		`/news-room/${slug}/index.html`,
		`/news-room/${slug}.data`,
		`/news-room/${slug}.data?_routes=routes%2Fnews-room-page`,
		`//news-room/${slug}`,
		`/news-room/./${slug}/index.html`,
		`/news-room/%${slug.charCodeAt(0).toString(16)}${slug.slice(1)}/index.html`,
		bodyChunk(article(slug)),
		article(slug).coverImage!
	]

	it('hands every spelling of a scheduled article to the app on production', async () => {
		deployAs(PRODUCTION, BEFORE)
		for (const path of fileSpellings(scheduled.slug)) {
			const response = await fetchPath(path)
			const body = await response.text()
			expect(body, path).toBe('app')
			expect(response.status, path).toBe(404)
			expect(response.headers.get('cache-control'), path).toBe('no-store')
		}
		expect(appHandled).toHaveLength(fileSpellings(scheduled.slug).length)
	})

	it('serves the prerendered files on staging before the time', async () => {
		deployAs(STAGING, BEFORE)
		const page = await fetchPath(`/news-room/${scheduled.slug}`)
		expect(page.status).toBe(200)
		expect(await page.text()).toBe(`prerendered ${scheduled.slug}`)

		const payload = await fetchPath(`/news-room/${scheduled.slug}.data`)
		expect(await payload.text()).toBe(`data ${scheduled.slug}`)

		const body = await fetchPath(bodyChunk(scheduled))
		expect(await body.text()).toBe(`body ${scheduled.slug}`)
	})

	it('serves the prerendered files on production once the time passes', async () => {
		deployAs(PRODUCTION, AFTER)
		const page = await fetchPath(`/news-room/${scheduled.slug}`)
		expect(page.status).toBe(200)
		expect(await page.text()).toBe(`prerendered ${scheduled.slug}`)
	})

	it('leaves a published article to the static files on production', async () => {
		deployAs(PRODUCTION, BEFORE)
		const page = await fetchPath(`/news-room/${published.slug}`)
		expect(await page.text()).toBe(`prerendered ${published.slug}`)
		const body = await fetchPath(bodyChunk(published))
		expect(await body.text()).toBe(`body ${published.slug}`)
		expect(appHandled).toEqual([])
	})
})

describe('the routes that answer for an article or list them', () => {
	it('the article loader is a 404 on production before the time, a page after', async () => {
		const { loader } =
			await import('../app/routes/news-room-page/news-room-article-page')
		const args = {
			params: { slug: scheduled.slug },
			request: new Request(`${PRODUCTION}/news-room/${scheduled.slug}`),
			context: {}
		} as unknown as Parameters<typeof loader>[0]

		deployAs(PRODUCTION, BEFORE)
		const refusal = await loader(args).catch((error: unknown) => error)
		expect(refusal).toBeInstanceOf(Response)
		expect((refusal as Response).status).toBe(404)

		deployAs(STAGING, BEFORE)
		expect((await loader(args)).data.article.slug).toBe(scheduled.slug)

		deployAs(PRODUCTION, AFTER)
		expect((await loader(args)).data.article.slug).toBe(scheduled.slug)
	})

	it('the article cross-links name only published articles, even on staging', async () => {
		const { loader } =
			await import('../app/routes/news-room-page/news-room-article-page')
		deployAs(STAGING, BEFORE)
		const { adjacent, related } = (
			await loader({
				params: { slug: published.slug },
				request: new Request(`${STAGING}/news-room/${published.slug}`),
				context: {}
			} as unknown as Parameters<typeof loader>[0])
		).data
		const linked = [adjacent.previous, adjacent.next, ...related]
			.filter(Boolean)
			.map((article) => article!.slug)
		expect(linked.length).toBeGreaterThan(0)
		expect(linked).not.toContain(scheduled.slug)
	})

	it('the markdown twin is a no-store 404 on production before the time', async () => {
		const { loader } = await import('../app/routes/page-markdown[.]md')
		const request = new Request(`${PRODUCTION}/news-room/${scheduled.slug}.md`)

		deployAs(PRODUCTION, BEFORE)
		const refusal = (await Promise.resolve()
			.then(() =>
				loader({ request } as unknown as Parameters<typeof loader>[0])
			)
			.catch((error: unknown) => error)) as Response
		expect(refusal.status).toBe(404)
		expect(refusal.headers.get('Cache-Control')).toBe('no-store')

		deployAs(STAGING, BEFORE)
		expect(
			loader({ request } as unknown as Parameters<typeof loader>[0]).status
		).toBe(200)
		deployAs(PRODUCTION, AFTER)
		expect(
			loader({ request } as unknown as Parameters<typeof loader>[0]).status
		).toBe(200)
	})

	it('the index lists it on staging and on production only after the time', async () => {
		const { loader } =
			await import('../app/routes/news-room-page/news-room-page')
		const list = async () =>
			slugs(
				(
					await loader({
						request: new Request(`${PRODUCTION}/news-room`),
						params: {},
						context: {}
					} as unknown as Parameters<typeof loader>[0])
				).data.articles
			)

		deployAs(PRODUCTION, BEFORE)
		expect(await list()).not.toContain(scheduled.slug)
		expect(await list()).toContain(published.slug)
		deployAs(STAGING, BEFORE)
		expect(await list()).toContain(scheduled.slug)
		deployAs(PRODUCTION, AFTER)
		expect(await list()).toContain(scheduled.slug)
	})

	it('the sitemap lists it on production only after the time, for five minutes at the edge', async () => {
		const { loader } = await import('../app/routes/sitemap[.]xml')
		const path = `/news-room/${scheduled.slug}</loc>`

		deployAs(PRODUCTION, BEFORE)
		const before = await loader()
		expect(await before.text()).not.toContain(path)
		expect(before.headers.get('Cache-Control')).toMatch(/s-maxage=300\b/)

		deployAs(PRODUCTION, AFTER)
		expect(await (await loader()).text()).toContain(path)
	})

	it('llms.txt lists it only after the time, on staging too, for five minutes at the edge', async () => {
		const { loader } = await import('../app/routes/llms[.]txt')
		const twin = `/news-room/${scheduled.slug}.md)`

		for (const deployment of [PRODUCTION, STAGING]) {
			deployAs(deployment, BEFORE)
			const before = loader()
			expect(await before.text(), deployment).not.toContain(twin)
			expect(before.headers.get('Cache-Control')).toMatch(/s-maxage=300\b/)

			deployAs(deployment, AFTER)
			expect(await loader().text(), deployment).toContain(twin)
		}
	})
})
