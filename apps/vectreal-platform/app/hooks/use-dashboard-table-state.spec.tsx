// @vitest-environment jsdom
/**
 * What is typed into a dashboard table's search never reaches the URL.
 *
 * It used to be written to `?<namespace>-q=` on every keystroke, and the URL
 * is what PostHog records on each pageview, what history keeps and what the
 * next request sends as its Referer. On the API keys page the natural thing
 * to paste into that box is a live key.
 */
import { act, render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import { useDashboardTableState } from './use-dashboard-table-state'

const SECRET = 'vctrl_live_0123456789abcdef'

function renderTable(initialUrl: string) {
	const probe: {
		state?: ReturnType<typeof useDashboardTableState>
		search?: string
		navigate?: ReturnType<typeof createMemoryRouter>['navigate']
	} = {}

	function Table() {
		probe.state = useDashboardTableState({ namespace: 'keys' })
		probe.search = useLocation().search
		return null
	}

	// One route for every folder, so the table stays mounted as it does in the dashboard.
	const router = createMemoryRouter([{ path: '/*', Component: Table }], {
		initialEntries: [initialUrl]
	})
	probe.navigate = router.navigate
	render(<RouterProvider router={router} />)
	return probe
}

describe('dashboard table search', () => {
	it('filters by what was typed without writing it to the URL', () => {
		const probe = renderTable('/')

		act(() => probe.state?.setSearchValue(SECRET))

		expect(probe.state?.searchValue).toBe(SECRET)
		expect(decodeURIComponent(probe.search ?? '')).not.toContain(SECRET)
	})

	it('still returns to the first page, since the result set changed', () => {
		const probe = renderTable('/?keys-page=3')

		act(() => probe.state?.setSearchValue('studio'))

		expect(new URLSearchParams(probe.search).get('keys-page')).toBe('1')
		expect(probe.state?.pagination.pageIndex).toBe(0)
		// Same path, new query: what was typed stays in the box.
		expect(probe.state?.searchValue).toBe('studio')
	})

	it('starts empty in the next folder', async () => {
		const probe = renderTable('/folders/a')

		act(() => probe.state?.setSearchValue('studio'))
		await act(() => probe.navigate?.('/folders/b'))

		expect(probe.state?.searchValue).toBe('')
	})
})
