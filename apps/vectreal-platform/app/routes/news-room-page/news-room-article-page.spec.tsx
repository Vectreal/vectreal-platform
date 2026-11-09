// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import NewsRoomArticlePage, { loader } from './news-room-article-page'
import {
	getNewsArticles,
	getRelatedNewsArticles
} from '../../lib/news/news-manifest.server'
import { PostHogProvider } from '../../lib/posthog/posthog-react'

const capture = vi.fn()
// One client, as the real hook returns: a fresh object would re-run every effect.
const client = { capture }
// Set by the test that delivers PostHog late, through the real provider.
let readsProvider = false
vi.mock('../../lib/posthog/posthog-react', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../lib/posthog/posthog-react')>()
	return {
		...actual,
		usePostHog: () => {
			const provided = actual.usePostHog()
			return readsProvider ? provided : client
		}
	}
})
// jsdom has no matchMedia; the table of contents rebuilds on the nav breakpoint.
vi.mock('@shared/components/hooks/use-mobile', () => ({
	useIsMobile: () => false
}))
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
	// Today rather than the epoch: an article dated after the clock is
	// scheduled, and a scheduled article is never a cross-link.
	const START = Date.now()

	beforeEach(() => {
		capture.mockClear()
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(START)
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
		vi.setSystemTime(START + 60_000)
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

		vi.setSystemTime(START + 65_000)
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

/*
  PostHog loads after hydration (`posthog-browser.ts`). What happened before
  it arrived is reported when it does, not marked as seen and dropped.
*/
describe('a newsroom article read before PostHog has loaded', () => {
	afterEach(() => {
		cleanup()
		readsProvider = false
	})

	it('reports the view and the milestones already passed, once', async () => {
		capture.mockClear()
		readsProvider = true
		Object.defineProperty(document.documentElement, 'scrollHeight', {
			configurable: true,
			value: 2000
		})
		Object.defineProperty(window, 'innerHeight', {
			configurable: true,
			value: 1000
		})
		scrollTo(0)
		const [article] = getNewsArticles()
		let arrive: (value: typeof client) => void = () => {}
		const loaded = new Promise<typeof client>((resolve) => {
			arrive = resolve
		})
		const Stub = createRoutesStub([
			{
				path: '/news-room/:slug',
				Component: NewsRoomArticlePage as never,
				loader: loader as never
			}
		])

		await act(async () => {
			render(
				<PostHogProvider client={loaded as never}>
					<Stub initialEntries={[`/news-room/${article.slug}`]} />
				</PostHogProvider>
			)
		})
		act(() => scrollTo(300))
		expect(capture).not.toHaveBeenCalled()

		await act(async () => arrive(client))

		expect(eventsFor('newsroom_article_viewed', article.slug)).toHaveLength(1)
		expect(
			eventsFor('newsroom_article_scroll_milestone', article.slug).map(
				(props) => props.milestone_percent
			)
		).toEqual([25])
	})
})
