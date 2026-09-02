// @vitest-environment jsdom
/**
 * The rule that broke three times.
 *
 * Every case below is a real defect this hook's predecessor shipped, found in
 * three separate review rounds while adding key rotation. They are written as
 * distinct tests rather than one because each was patched separately before the
 * mechanism itself was recognized as the cause.
 */

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useOncePerFetcherResponse } from './use-once-per-fetcher-response'

type Fetcher<T> = { state: string; data: T | undefined | null }

function renderWith<T>(fetcher: Fetcher<T>, handle: (data: T) => void) {
	function Probe({ value }: { value: Fetcher<T> }) {
		useOncePerFetcherResponse(value, handle)
		return null
	}

	const view = render(<Probe value={fetcher} />)
	return {
		settle: (next: Fetcher<T>) => view.rerender(<Probe value={next} />)
	}
}

const idle = <T,>(data: T): Fetcher<T> => ({ state: 'idle', data })

describe('useOncePerFetcherResponse', () => {
	it('ignores a fetcher that has not been used', () => {
		const handle = vi.fn()
		renderWith({ state: 'idle', data: undefined }, handle)

		expect(handle).not.toHaveBeenCalled()
	})

	it('ignores a response that is still in flight', () => {
		const handle = vi.fn()
		renderWith({ state: 'submitting', data: { ok: true } }, handle)

		expect(handle).not.toHaveBeenCalled()
	})

	it('handles a settled response once', () => {
		const handle = vi.fn()
		renderWith(idle({ ok: true }), handle)

		expect(handle).toHaveBeenCalledOnce()
	})

	it('does not re-handle the same response when the component re-renders', () => {
		const handle = vi.fn()
		const response = { ok: true }
		const { settle } = renderWith(idle(response), handle)

		// The same object, as a revalidation cycle would deliver it.
		settle({ state: 'idle', data: response })
		settle({ state: 'idle', data: response })

		expect(handle).toHaveBeenCalledOnce()
	})

	/*
	  Defect 1: two revokes returned `{ success: true, message: 'API key revoked
	  successfully' }`, so the second was swallowed - no toast, no revalidation.
	*/
	it('handles a second response whose body repeats the first', () => {
		const handle = vi.fn()
		const { settle } = renderWith(
			idle({ success: true, message: 'API key revoked successfully' }),
			handle
		)

		settle(idle({ success: true, message: 'API key revoked successfully' }))

		expect(handle).toHaveBeenCalledTimes(2)
	})

	/*
	  Defect 2: `revokeApiKey` and `rotateApiKey` throw byte-identical messages
	  for a key that cannot be found, so a second failure looked like the first.
	*/
	it('handles a second failure carrying the same message', () => {
		const handle = vi.fn()
		const { settle } = renderWith(
			idle({ error: 'API key not found or access denied' }),
			handle
		)

		settle(idle({ error: 'API key not found or access denied' }))

		expect(handle).toHaveBeenCalledTimes(2)
	})

	/*
	  Defect 3: a CSRF rejection body carries nothing that varies, so after the
	  first one the page went silently unresponsive to every further attempt.
	*/
	it('handles every repeat of a fixed rejection body', () => {
		const handle = vi.fn()
		const csrf = () => idle({ success: false, error: 'Invalid CSRF token' })
		const { settle } = renderWith(csrf(), handle)

		settle(csrf())
		settle(csrf())

		expect(handle).toHaveBeenCalledTimes(3)
	})

	/*
	  Defect 4: `fetcher.reset()` settles with `getDoneFetcher(null)`, not
	  `undefined`, so a guard written against `undefined` alone hands the reset
	  to the handler as though it were a response. No caller resets today; the
	  guard is what keeps that true for the one that does.
	*/
	it('ignores a fetcher reset after it has answered', () => {
		const handle = vi.fn()
		const { settle } = renderWith(idle({ ok: true }), handle)
		expect(handle).toHaveBeenCalledOnce()

		settle({ state: 'idle', data: null })

		expect(handle).toHaveBeenCalledOnce()
	})

	it('does not re-run when only the handler identity changes', () => {
		const first = vi.fn()
		const response = { ok: true }

		function Probe({ handle }: { handle: (data: unknown) => void }) {
			useOncePerFetcherResponse({ state: 'idle', data: response }, handle)
			return null
		}

		const view = render(<Probe handle={first} />)
		const second = vi.fn()
		view.rerender(<Probe handle={second} />)

		expect(first).toHaveBeenCalledOnce()
		expect(second).not.toHaveBeenCalled()
	})
})
