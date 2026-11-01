/**
 * Search engines hear about an article when it goes live on production, once,
 * and not from staging. The newest real article stands in for one going live:
 * the clock is set around its `publishedAt`, when every other article is
 * already published.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	INDEXNOW_KEY,
	articleUrlsLiveBetween,
	startIndexNowSubmissions,
	submitToIndexNow
} from '../app/lib/news/news-indexnow.server'
import { getPublishedNewsArticles } from '../app/lib/news/news-manifest.server'
import { resolvePublishedAt } from '../app/lib/news/news-schedule'

const [newest, previous] = getPublishedNewsArticles()
const LIVE_AT = resolvePublishedAt(newest.publishedAt)
const MINUTE = 60_000
const newestUrl = `https://vectreal.com/news-room/${newest.slug}`
const previousUrl = `https://vectreal.com/news-room/${previous.slug}`

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
	vi.stubEnv('DEV', false)
	vi.stubEnv('IS_RR_BUILD_REQUEST', '')
	vi.stubEnv('APPLICATION_URL', 'https://vectreal.com')
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('the stand-in article', () => {
	it('went live more than a day after the one before it', () => {
		expect(resolvePublishedAt(previous.publishedAt)).toBeLessThan(
			LIVE_AT - 24 * 60 * MINUTE
		)
	})
})

describe('articleUrlsLiveBetween', () => {
	it('names an article from the moment it goes live, inside the window only', () => {
		expect(articleUrlsLiveBetween(LIVE_AT - MINUTE, LIVE_AT - 1)).toEqual([])
		expect(articleUrlsLiveBetween(LIVE_AT - MINUTE, LIVE_AT)).toEqual([
			newestUrl
		])
		expect(articleUrlsLiveBetween(LIVE_AT, LIVE_AT + MINUTE)).toEqual([])
	})
})

describe('startIndexNowSubmissions', () => {
	function start(applicationUrl: string, at: number) {
		vi.stubEnv('APPLICATION_URL', applicationUrl)
		let clock = at
		const submit = vi.fn(async (_urls: string[]) => {})
		const stop = startIndexNowSubmissions({ now: () => clock, submit })
		const advance = (ms: number) => {
			clock += ms
			vi.advanceTimersByTime(ms)
		}
		const submitted = () => submit.mock.calls.flatMap(([urls]) => urls)
		return { stop, advance, submitted }
	}

	it('submits an article once, at the first check after it goes live', () => {
		const { stop, advance, submitted } = start(
			'https://vectreal.com',
			LIVE_AT - 7 * MINUTE
		)
		expect(submitted()).toEqual([])

		advance(5 * MINUTE)
		expect(submitted()).toEqual([])

		advance(5 * MINUTE)
		expect(submitted()).toEqual([newestUrl])

		advance(60 * MINUTE)
		expect(submitted()).toEqual([newestUrl])
		stop()
	})

	it('catches up on a start within a day of going live, and no further back', () => {
		const { stop, submitted } = start(
			'https://vectreal.com',
			LIVE_AT + 3 * 60 * MINUTE
		)
		expect(submitted()).toEqual([newestUrl])
		expect(submitted()).not.toContain(previousUrl)
		stop()
	})

	it.each(['', 'not a url', 'http://localhost:3000'])(
		'submits nothing where APPLICATION_URL is %j, as on a local run',
		(applicationUrl) => {
			const { stop, submitted } = start(applicationUrl, LIVE_AT + MINUTE)
			expect(submitted()).toEqual([])
			stop()
		}
	)

	it('submits nothing from staging', () => {
		const { stop, advance, submitted } = start(
			'https://staging.vectreal.com',
			LIVE_AT - MINUTE
		)
		advance(10 * MINUTE)
		expect(submitted()).toEqual([])
		stop()
	})

	it('stops checking when stopped', () => {
		const { stop, advance, submitted } = start(
			'https://vectreal.com',
			LIVE_AT - 7 * MINUTE
		)
		stop()
		advance(10 * MINUTE)
		expect(submitted()).toEqual([])
	})
})

describe('submitToIndexNow', () => {
	it('posts the URLs with the host and key', async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
		vi.stubGlobal('fetch', fetchMock)

		await submitToIndexNow([newestUrl])

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0] as unknown as [
			string,
			RequestInit
		]
		expect(url).toBe('https://api.indexnow.org/indexnow')
		expect(init.method).toBe('POST')
		expect(init.signal).toBeInstanceOf(AbortSignal)
		expect(JSON.parse(String(init.body))).toEqual({
			host: 'vectreal.com',
			key: INDEXNOW_KEY,
			urlList: [newestUrl]
		})
	})

	it('sends nothing when nothing went live', async () => {
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		await submitToIndexNow([])
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('logs a refusal or a network failure instead of throwing', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 403 }))
		)
		await expect(submitToIndexNow([newestUrl])).resolves.toBeUndefined()
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('403'))

		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('offline')
			})
		)
		await expect(submitToIndexNow([newestUrl])).resolves.toBeUndefined()
		expect(warn).toHaveBeenCalledTimes(2)
	})
})

describe('the key file', () => {
	it('is in public/, which the build copies to the site root, and holds exactly the key', () => {
		const file = readFileSync(
			join(__dirname, '../public', `${INDEXNOW_KEY}.txt`),
			'utf8'
		)
		expect(file).toBe(INDEXNOW_KEY)
		expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/)
	})
})
