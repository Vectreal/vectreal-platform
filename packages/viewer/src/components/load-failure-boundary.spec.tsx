// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import LoadFailureBoundary from './load-failure-boundary'

const FailedLoad = (): never => {
	throw new Error('404')
}

describe('LoadFailureBoundary', () => {
	it('contains a failed load and reports it', () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
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
	})
})
