// @vitest-environment jsdom
/**
 * `LoadProgressIndicator`, the one progress pattern for a model on its way.
 *
 * It lives in `shared/components`, which has no test project of its own, so
 * its behavior is pinned here, beside `shared-controls.spec.tsx`.
 *
 * Mutation gates, executed:
 *  - measure `percent` from `items` while parsing and the ring test goes red
 *    (a count whose total grows is not a fraction);
 *  - drop the delay's `invisible` and the fast-load test goes red;
 *  - put the bytes into the live region and the announcement test goes red.
 */
import {
	LOAD_PROGRESS_WORDS,
	LoadProgressIndicator
} from '@shared/components/ui/load-progress-indicator'
import { formatFileSize } from '@shared/utils'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const MB = 1024 * 1024

afterEach(() => {
	vi.useRealTimers()
})

const bar = () => screen.getByRole('progressbar', { hidden: true })
const live = (container: HTMLElement) =>
	container.querySelector('[aria-live="polite"]')

describe('LoadProgressIndicator', () => {
	it('measures a download with a known size, and names what it downloads', () => {
		render(
			<LoadProgressIndicator
				delayMs={0}
				subject="Rocket"
				progress={{
					phase: 'fetching',
					bytes: { loaded: 4 * MB, total: 16 * MB }
				}}
			/>
		)

		expect(bar().getAttribute('aria-valuenow')).toBe('25')
		expect(screen.getByText('Downloading Rocket')).toBeTruthy()
		expect(
			screen.getByText(
				`${formatFileSize(4 * MB)} of ${formatFileSize(16 * MB)}`
			)
		).toBeTruthy()
	})

	it('shows bytes without a percentage when no size is known', () => {
		render(
			<LoadProgressIndicator
				delayMs={0}
				progress={{ phase: 'fetching', bytes: { loaded: 2 * MB, total: null } }}
			/>
		)

		expect(bar().getAttribute('aria-valuenow')).toBeNull()
		expect(screen.getByText(formatFileSize(2 * MB))).toBeTruthy()
	})

	it('turns indeterminate while parsing, and counts files in words', () => {
		render(
			<LoadProgressIndicator
				delayMs={0}
				progress={{ phase: 'parsing', items: { loaded: 3, total: 8 } }}
			/>
		)

		expect(bar().getAttribute('aria-valuenow')).toBeNull()
		expect(screen.getByText(LOAD_PROGRESS_WORDS.parsing)).toBeTruthy()
		expect(screen.getByText('3 of 8 files')).toBeTruthy()
	})

	it('announces the phase, never the numbers', () => {
		const { container, rerender } = render(
			<LoadProgressIndicator
				delayMs={0}
				progress={{ phase: 'fetching', bytes: { loaded: 1, total: 10 } }}
			/>
		)
		expect(live(container)?.textContent).toBe('Downloading')

		rerender(
			<LoadProgressIndicator
				delayMs={0}
				progress={{ phase: 'fetching', bytes: { loaded: 5, total: 10 } }}
			/>
		)
		expect(live(container)?.textContent).toBe('Downloading')

		rerender(
			<LoadProgressIndicator delayMs={0} progress={{ phase: 'preparing' }} />
		)
		expect(live(container)?.textContent).toBe(LOAD_PROGRESS_WORDS.preparing)
	})

	it('draws nothing for a load faster than its delay', () => {
		vi.useFakeTimers()
		const { container } = render(
			<LoadProgressIndicator progress={{ phase: 'parsing' }} />
		)

		const root = container.firstElementChild as HTMLElement
		expect(root.className).toContain('invisible')
		expect(live(container)?.textContent).toBe('')

		act(() => vi.advanceTimersByTime(300))
		expect(root.className).not.toContain('invisible')
		expect(live(container)?.textContent).toBe(LOAD_PROGRESS_WORDS.parsing)
	})
	it('says only that it is loading while nothing is known', () => {
		render(<LoadProgressIndicator delayMs={0} progress={null} />)

		expect(screen.getByText(LOAD_PROGRESS_WORDS.loading)).toBeTruthy()
		expect(bar().getAttribute('aria-valuenow')).toBeNull()
	})

	it('leaves announcing to a container that is already a live region', () => {
		const { container } = render(
			<LoadProgressIndicator
				delayMs={0}
				announce={false}
				progress={{ phase: 'parsing' }}
			/>
		)

		expect(live(container)).toBeNull()
	})
})
