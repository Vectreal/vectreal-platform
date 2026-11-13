// @vitest-environment jsdom
/**
 * The dashboard asks for its internal links after it is on screen, so a slow
 * flag check never holds the page, nothing internal shows before the answer,
 * and a failed request only leaves the links out.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	DASHBOARD_INTERNAL_PAGES_URL,
	useDashboardInternalPages
} from './use-dashboard-internal-pages'

const NONE = { generations: false, intake: false }

function answer(data: unknown, status = 200) {
	return new Response(JSON.stringify({ success: true, data }), { status })
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('useDashboardInternalPages', () => {
	it('renders at once with nothing open while the flag checks are still out', () => {
		const fetch = vi.fn(() => new Promise<Response>(() => {}))
		vi.stubGlobal('fetch', fetch)

		const { result } = renderHook(() => useDashboardInternalPages())

		expect(result.current).toEqual(NONE)
		expect(fetch).toHaveBeenCalledWith(
			DASHBOARD_INTERNAL_PAGES_URL,
			expect.anything()
		)
	})

	it('opens what the answer opens, once it arrives, asking only once', async () => {
		const fetch = vi.fn(async () =>
			answer({ generations: true, intake: false })
		)
		vi.stubGlobal('fetch', fetch)

		const { result, rerender } = renderHook(() => useDashboardInternalPages())

		await waitFor(() =>
			expect(result.current).toEqual({ generations: true, intake: false })
		)
		rerender()
		expect(fetch).toHaveBeenCalledOnce()
	})

	it.each([
		['a refused request', async () => answer({ generations: true }, 502)],
		[
			'a body that is not the answer',
			async () => new Response('<html>Bad gateway</html>')
		],
		[
			'a dropped connection',
			async () => {
				throw new TypeError('Failed to fetch')
			}
		]
	])('leaves everything closed after %s', async (_, respond) => {
		const fetch = vi.fn(respond)
		vi.stubGlobal('fetch', fetch)

		const { result } = renderHook(() => useDashboardInternalPages())

		await waitFor(() => expect(fetch).toHaveBeenCalled())
		await new Promise((resolve) => setTimeout(resolve, 20))
		expect(result.current).toEqual(NONE)
	})
})
