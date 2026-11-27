// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import NewsRoomPage, { loader } from './news-room-page'

const capture = vi.fn()
// One client, as the real hook returns: a fresh object would re-run every effect.
const client = { capture }
vi.mock('../../lib/posthog/posthog-react', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../lib/posthog/posthog-react')>()),
	usePostHog: () => client
}))
// No analytics consent: the banner has not been answered.
vi.mock('../../components/consent/consent-context', () => ({
	useConsent: () => ({ consent: null })
}))

// jsdom has no matchMedia; the layout reads breakpoints and motion settings.
beforeEach(() => {
	vi.stubGlobal('matchMedia', () => ({
		matches: false,
		addEventListener() {},
		removeEventListener() {}
	}))
})

afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
})

// A funnel step counted without consent: see `cookieless-events.ts`.
it('reports the newsroom listing viewed without analytics consent, once', async () => {
	const Stub = createRoutesStub([
		{
			path: '/news-room',
			HydrateFallback: () => null,
			Component: NewsRoomPage as never,
			loader: loader as never
		}
	])

	await act(async () => {
		render(<Stub initialEntries={['/news-room']} />)
	})

	expect(
		capture.mock.calls.filter(([event]) => event === 'newsroom_listing_viewed')
	).toEqual([
		[
			'newsroom_listing_viewed',
			expect.objectContaining({ has_query: false, has_category_filter: false })
		]
	])
})
