// @vitest-environment jsdom
/**
 * The one reading of a model load's progress (`describeLoadProgress`,
 * `useDelayedVisible`) and the app's drawing of it (`LoadProgressIndicator`).
 *
 * They live in `shared/components`, which has no test project of its own, so
 * their behavior is pinned here, beside `shared-controls.spec.tsx`.
 *
 * Mutation gates, executed:
 *  - take `percent` from `items` while parsing and the parsing test goes red
 *    (a count whose total grows is not a fraction);
 *  - round instead of floor and the 99.6% test goes red;
 *  - drop the effect's early `setVisible(true)` and the shortened-delay test
 *    goes red;
 *  - drop `aria-valuetext` and the numbers test goes red;
 *  - drop the effect's `clearTimeout`, or count `remaining` from the change
 *    instead of from mount, and a `useDelayedVisible` test goes red;
 *  - fill the live region before the delay ends and the fast-load test goes red.
 */
import {
	describeLoadProgress,
	LOAD_PROGRESS_WORDS,
	useDelayedVisible
} from '@shared/components/ui/load-progress'
import { LoadProgressIndicator } from '@shared/components/ui/load-progress-indicator'
import { formatFileSize } from '@shared/utils'
import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const MB = 1024 * 1024

afterEach(() => {
	vi.useRealTimers()
})

describe('describeLoadProgress', () => {
	it('measures a download with a known size, and names what it downloads', () => {
		expect(
			describeLoadProgress(
				{ phase: 'fetching', bytes: { loaded: 4 * MB, total: 16 * MB } },
				LOAD_PROGRESS_WORDS,
				'Rocket'
			)
		).toEqual({
			title: 'Downloading Rocket',
			detail: `${formatFileSize(4 * MB)} of ${formatFileSize(16 * MB)}`,
			percent: 25
		})
	})

	it('never reads 100 while bytes are still arriving', () => {
		const { percent } = describeLoadProgress({
			phase: 'fetching',
			bytes: { loaded: 996, total: 1000 }
		})
		expect(percent).toBe(99)
	})

	it('drops a size the download outgrew, rather than read past it', () => {
		expect(
			describeLoadProgress({
				phase: 'fetching',
				bytes: { loaded: 20 * MB, total: 16 * MB }
			})
		).toMatchObject({ detail: formatFileSize(20 * MB), percent: null })
	})

	it('gives bytes without a percentage when no size is known', () => {
		expect(
			describeLoadProgress({
				phase: 'fetching',
				bytes: { loaded: 2 * MB, total: null }
			})
		).toMatchObject({ detail: formatFileSize(2 * MB), percent: null })
	})

	it('counts files in words while parsing, never as a percentage', () => {
		expect(
			describeLoadProgress({ phase: 'parsing', items: { loaded: 3, total: 8 } })
		).toEqual({
			title: LOAD_PROGRESS_WORDS.parsing,
			detail: '3 of 8 files',
			percent: null
		})
	})

	it('says only that it is loading while nothing is known', () => {
		expect(describeLoadProgress(null)).toEqual({
			title: LOAD_PROGRESS_WORDS.loading,
			detail: null,
			percent: null
		})
	})
})

describe('useDelayedVisible', () => {
	it('shows after the delay, not before', () => {
		vi.useFakeTimers()
		const { result } = renderHook(() => useDelayedVisible(300))
		expect(result.current).toBe(false)
		act(() => vi.advanceTimersByTime(299))
		expect(result.current).toBe(false)
		act(() => vi.advanceTimersByTime(1))
		expect(result.current).toBe(true)
	})

	it('counts a lengthened delay from mount, not from the change', () => {
		vi.useFakeTimers()
		const { result, rerender } = renderHook(
			({ delay }) => useDelayedVisible(delay),
			{ initialProps: { delay: 300 } }
		)
		act(() => vi.advanceTimersByTime(200))
		rerender({ delay: 500 })
		act(() => vi.advanceTimersByTime(299))
		expect(result.current).toBe(false)
		act(() => vi.advanceTimersByTime(1))
		expect(result.current).toBe(true)
	})

	it('leaves no timer behind when it unmounts first', () => {
		vi.useFakeTimers()
		const { unmount } = renderHook(() => useDelayedVisible(300))
		unmount()
		expect(vi.getTimerCount()).toBe(0)
	})

	it('shows at once when the delay is shortened past the time waited', () => {
		vi.useFakeTimers()
		const { result, rerender } = renderHook(
			({ delay }) => useDelayedVisible(delay),
			{ initialProps: { delay: 300 } }
		)
		act(() => vi.advanceTimersByTime(100))
		rerender({ delay: 0 })
		expect(result.current).toBe(true)
	})
})

describe('LoadProgressIndicator', () => {
	it('gives a screen reader the phase as the name and the numbers as the value', () => {
		render(
			<LoadProgressIndicator
				delayMs={0}
				progress={{ phase: 'parsing', items: { loaded: 3, total: 8 } }}
			/>
		)

		const bar = screen.getByRole('progressbar')
		expect(bar.getAttribute('aria-label')).toBe(LOAD_PROGRESS_WORDS.parsing)
		expect(bar.getAttribute('aria-valuetext')).toBe('3 of 8 files')
		expect(bar.getAttribute('aria-valuenow')).toBeNull()
	})

	it('announces the phase, never the numbers', () => {
		const { container, rerender } = render(
			<LoadProgressIndicator
				delayMs={0}
				progress={{ phase: 'fetching', bytes: { loaded: 1, total: 10 } }}
			/>
		)
		const live = () => container.querySelector('[aria-live="polite"]')
		expect(live()?.textContent).toBe('Downloading')

		rerender(
			<LoadProgressIndicator
				delayMs={0}
				progress={{ phase: 'fetching', bytes: { loaded: 5, total: 10 } }}
			/>
		)
		expect(live()?.textContent).toBe('Downloading')

		rerender(
			<LoadProgressIndicator delayMs={0} progress={{ phase: 'preparing' }} />
		)
		expect(live()?.textContent).toBe(LOAD_PROGRESS_WORDS.preparing)
	})

	it('draws nothing for a load faster than its delay', () => {
		vi.useFakeTimers()
		const { container } = render(
			<LoadProgressIndicator progress={{ phase: 'parsing' }} />
		)

		const root = container.querySelector('div') as HTMLElement
		const live = container.querySelector('[aria-live="polite"]')
		expect(root.className).toContain('invisible')
		// Mounted, so the reader knows it, and empty, so a fast load says nothing.
		expect(live?.textContent).toBe('')
		expect(root.contains(live)).toBe(false)
		act(() => vi.advanceTimersByTime(300))
		expect(root.className).not.toContain('invisible')
		expect(live?.textContent).toBe(LOAD_PROGRESS_WORDS.parsing)
	})
})
