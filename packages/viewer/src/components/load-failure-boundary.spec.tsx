// @vitest-environment jsdom
import { format } from 'node:util'

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LoadFailureBoundary from './load-failure-boundary'

const FailedLoad = (): never => {
	throw new Error('404')
}

describe('LoadFailureBoundary', () => {
	it('contains a failed load and reports it', () => {
		const logged = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined)
		const onError = vi.fn()

		const { container } = render(
			<div data-testid="scene">
				<LoadFailureBoundary onError={onError}>
					<FailedLoad />
				</LoadFailureBoundary>
			</div>
		)

		expect(container.querySelector('[data-testid="scene"]')).not.toBeNull()
		expect(onError).toHaveBeenCalledOnce()
		expect(logged).toHaveBeenCalled()
		// What this failure logs, and nothing else.
		for (const args of logged.mock.calls) {
			expect(format(...args)).toMatch(/404/)
		}
	})
})
