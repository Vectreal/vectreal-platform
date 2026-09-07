// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useViewerLoading } from './use-viewer-loading'

/**
 * `loaded` is a waiting room for the loader's fade-out, and it is left by that
 * element's own `transitionend`. So whether a loader exists decides whether
 * the state can ever reach `ready` - and `ready` is what the viewer's chrome
 * is gated on.
 */

const render = (hasLoader: boolean) =>
	renderHook(
		({ framed }: { framed: boolean }) =>
			useViewerLoading(true, framed, hasLoader),
		{ initialProps: { framed: false } }
	)

describe('useViewerLoading', () => {
	it('waits in `loaded` for the loader to fade out', () => {
		const { result, rerender } = render(true)

		expect(result.current.loadingState).toBe('loading')

		rerender({ framed: true })
		expect(result.current.loadingState).toBe('loaded')

		act(() => result.current.completeLoadingTransition())
		expect(result.current.loadingState).toBe('ready')
	})

	it('is ready immediately when there is no loader to fade', () => {
		// A consumer passing `loader={null}` schedules no transition, so nothing
		// would ever call `completeLoadingTransition`. Stopping in `loaded` here
		// hid the info popover and the playback controls permanently.
		const { result, rerender } = render(false)

		rerender({ framed: true })
		expect(result.current.loadingState).toBe('ready')
	})

	it('returns to loading when the content goes away', () => {
		const { result, rerender } = render(true)

		rerender({ framed: true })
		act(() => result.current.completeLoadingTransition())
		expect(result.current.loadingState).toBe('ready')

		rerender({ framed: false })
		expect(result.current.loadingState).toBe('loading')
	})
})
