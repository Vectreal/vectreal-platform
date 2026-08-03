/**
 * The two-step close for drawers whose visibility is a route.
 *
 * The bug this hook exists for: navigating straight out of `onOpenChange`
 * unmounts the route, so vaul never gets to animate the exit and the drawer
 * cut out instead of sliding away. What matters here is the *order* - the
 * drawer closes first, and the navigation only happens once the animation
 * reports done.
 */

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigate = vi.fn()

vi.mock('react-router', () => ({
	useNavigate: () => navigate
}))

const { useRouteDrawer } = await import('../app/hooks/use-route-drawer')

/** Renders the hook and exposes its latest return value. */
function mount(props: { isOpen: boolean; closeTo: string; replace?: boolean }) {
	const seen: Array<ReturnType<typeof useRouteDrawer>> = []

	function Probe(inner: typeof props) {
		seen.push(useRouteDrawer(inner))
		return null
	}

	const view = render(<Probe {...props} />)
	return {
		latest: () => seen[seen.length - 1],
		rerender: (next: typeof props) => view.rerender(<Probe {...next} />),
		unmount: view.unmount
	}
}

beforeEach(() => {
	vi.useFakeTimers()
	navigate.mockClear()
})

afterEach(() => {
	vi.useRealTimers()
})

describe('useRouteDrawer', () => {
	it('opens with the route', () => {
		expect(mount({ isOpen: true, closeTo: '/x' }).latest().open).toBe(true)
	})

	it('closes locally without navigating yet', () => {
		const drawer = mount({ isOpen: true, closeTo: '/x' })

		act(() => drawer.latest().onOpenChange(false))

		// The whole point: still mounted and closed, so vaul can animate out.
		expect(drawer.latest().open).toBe(false)
		expect(navigate).not.toHaveBeenCalled()
	})

	it('navigates once the close animation finishes', () => {
		const drawer = mount({ isOpen: true, closeTo: '/dashboard/projects?v=1' })

		act(() => drawer.latest().onOpenChange(false))
		act(() => drawer.latest().onAnimationEnd(false))

		expect(navigate).toHaveBeenCalledTimes(1)
		expect(navigate).toHaveBeenCalledWith('/dashboard/projects?v=1', {
			replace: false
		})
	})

	it('ignores the opening animation', () => {
		const drawer = mount({ isOpen: true, closeTo: '/x' })

		act(() => drawer.latest().onAnimationEnd(true))

		expect(navigate).not.toHaveBeenCalled()
	})

	it('navigates anyway if the animation never reports back', () => {
		// Reduced motion or an interrupted transition would otherwise leave the
		// drawer closed on a route that still says it is open.
		const drawer = mount({ isOpen: true, closeTo: '/x' })

		act(() => drawer.latest().onOpenChange(false))
		expect(navigate).not.toHaveBeenCalled()

		act(() => vi.advanceTimersByTime(700))
		expect(navigate).toHaveBeenCalledTimes(1)
	})

	it('does not navigate twice when the animation lands before the fallback', () => {
		const drawer = mount({ isOpen: true, closeTo: '/x' })

		act(() => drawer.latest().onOpenChange(false))
		act(() => drawer.latest().onAnimationEnd(false))
		act(() => vi.advanceTimersByTime(2000))

		expect(navigate).toHaveBeenCalledTimes(1)
	})

	it('follows the route closing from elsewhere, without navigating again', () => {
		// The back button already moved the route; animating out is all that is
		// left to do.
		const drawer = mount({ isOpen: true, closeTo: '/x' })

		act(() => drawer.rerender({ isOpen: false, closeTo: '/x' }))
		expect(drawer.latest().open).toBe(false)

		act(() => drawer.latest().onAnimationEnd(false))
		expect(navigate).not.toHaveBeenCalled()
	})

	it('reopens when the route comes back', () => {
		const drawer = mount({ isOpen: false, closeTo: '/x' })

		act(() => drawer.rerender({ isOpen: true, closeTo: '/x' }))

		expect(drawer.latest().open).toBe(true)
	})

	it('honors replace for callers that should not add history', () => {
		const drawer = mount({ isOpen: true, closeTo: '/x', replace: true })

		act(() => drawer.latest().onOpenChange(false))
		act(() => drawer.latest().onAnimationEnd(false))

		expect(navigate).toHaveBeenCalledWith('/x', { replace: true })
	})

	it('drops a pending fallback when the drawer unmounts', () => {
		const drawer = mount({ isOpen: true, closeTo: '/x' })

		act(() => drawer.latest().close())
		drawer.unmount()
		act(() => vi.advanceTimersByTime(2000))

		expect(navigate).not.toHaveBeenCalled()
	})
})
