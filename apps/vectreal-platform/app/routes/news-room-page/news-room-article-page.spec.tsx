// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import NewsRoomArticlePage, { loader } from './news-room-article-page'
import {
	getNewsArticles,
	getRelatedNewsArticles
} from '../../lib/news/news-manifest.server'

const capture = vi.fn()
// One client, as the real hook returns: a fresh object would re-run every effect.
const client = { capture }
vi.mock('@posthog/react', () => ({ usePostHog: () => client }))
vi.mock('../../components/consent/consent-context', () => ({
	useConsent: () => ({ consent: { analytics: true } })
}))
/* The bodies are lazy MDX chunks; what is measured here is the page around them. */
vi.mock('../../lib/news/news-article-body', () => ({
	getArticleBody: () => () => <p>body</p>
}))

/*
  The page heading says which article is on screen. Read directly rather than
  through a role query: those compute roles and accessible names across the
  whole article on every attempt, about 100ms here and several times that in a
  loaded worker pool, which left a full navigation too few polls to land
  inside the default one-second wait on CI.
*/
const pageHeading = () => document.querySelector('h1')?.textContent

const eventsFor = (event: string, slug: string) =>
	capture.mock.calls
		.filter(([name, props]) => name === event && props.slug === slug)
		.map(([, props]) => props)

function scrollTo(y: number) {
	Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
	window.dispatchEvent(new Event('scroll'))
}

/*
  Following a related-article card is a navigation between two URLs of one
  route, so React Router keeps the page mounted and hands it new loader data.
  That is the path that carried the first article's state into the second.
*/
describe('a newsroom article followed from another', () => {
	beforeEach(() => {
		capture.mockClear()
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(0)
		Object.defineProperty(document.documentElement, 'scrollHeight', {
			configurable: true,
			value: 2000
		})
		Object.defineProperty(window, 'innerHeight', {
			configurable: true,
			value: 1000
		})
		scrollTo(0)
	})

	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	async function openFirstThenRelated() {
		// The same pick the page's loader makes for its related cards.
		const first = getNewsArticles().find(
			(article) => getRelatedNewsArticles(article.slug, 3).length > 0
		)
		if (!first) throw new Error('no article with a related article')
		const second = getRelatedNewsArticles(first.slug, 3)[0]

		const Stub = createRoutesStub([
			{
				path: '/news-room/:slug',
				Component: NewsRoomArticlePage as never,
				loader: loader as never
			}
		])
		// Awaited rather than polled: the loader runs on promises alone, so act
		// settles the navigation however slow the machine is, where a wait has
		// a one-second deadline that a loaded parallel run can overrun.
		await act(async () => {
			render(<Stub initialEntries={[`/news-room/${first.slug}`]} />)
		})
		expect(pageHeading()).toBe(first.title)

		// Read the first article to the end over a minute.
		act(() => scrollTo(1000))
		vi.setSystemTime(60_000)
		act(() => scrollTo(0))

		const card = document.querySelector(`a[href$="/news-room/${second.slug}"]`)
		if (!card) throw new Error('no link to the related article')
		await act(async () => {
			fireEvent.click(card)
		})
		// The card shows the title too; the page heading is what says it arrived.
		expect(pageHeading()).toBe(second.title)

		return { first, second }
	}

	it('reports a view of the second article', async () => {
		const { second } = await openFirstThenRelated()

		expect(eventsFor('newsroom_article_viewed', second.slug)).toHaveLength(1)
	})

	it('reports the first article read when it is left', async () => {
		const { first } = await openFirstThenRelated()

		expect(eventsFor('newsroom_article_read_completed', first.slug)).toEqual([
			{ slug: first.slug, duration_ms: 60_000, max_scroll_percent: 100 }
		])
	})

	it("measures the second article's read from its own start and scroll", async () => {
		const { second } = await openFirstThenRelated()

		vi.setSystemTime(65_000)
		cleanup()

		expect(eventsFor('newsroom_article_read_completed', second.slug)).toEqual([
			{ slug: second.slug, duration_ms: 5_000, max_scroll_percent: 0 }
		])
	})

	it("reports the second article's scroll milestones afresh", async () => {
		const { second } = await openFirstThenRelated()

		act(() => scrollTo(1000))

		expect(
			eventsFor('newsroom_article_scroll_milestone', second.slug).map(
				(props) => props.milestone_percent
			)
		).toEqual([25, 50, 75, 100])
	})
})
