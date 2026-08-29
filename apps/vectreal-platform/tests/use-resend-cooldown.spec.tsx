// @vitest-environment jsdom
/**
 * The bug: the cooldown restarted once and never again.
 *
 * `wasSent` was derived from `fetcher.data?.sent`, and React Router carries the
 * previous `data` through a resubmission, so from the second send onward the
 * boolean was already true and the effect keyed on it never re-ran. Case 2 is
 * that scenario; it fails against the old spelling.
 */

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useResendCooldown } from '../app/hooks/use-resend-cooldown'

type Result = {
	sent?: boolean
	rateLimited?: boolean
	retryAfterSeconds?: number
}
type Fetcher = { state: string; data: Result | undefined }

/*
  The route's own policy, so the spec exercises what ships rather than a
  simplification of it: a send holds the button for a minute, a rate limit for
  as long as the server said, anything else leaves it alone.
*/
const routePolicy =
	(seconds: number) =>
	(result: Result): number | null => {
		if (result.sent) return seconds
		if (result.rateLimited) return result.retryAfterSeconds ?? seconds
		return null
	}

function renderWith(fetcher: Fetcher, seconds = 60) {
	let current = 0
	function Probe({ value }: { value: Fetcher }) {
		current = useResendCooldown(value, routePolicy(seconds))
		return null
	}
	const view = render(<Probe value={fetcher} />)
	return {
		get remaining() {
			return current
		},
		settle: (next: Fetcher) => view.rerender(<Probe value={next} />)
	}
}

const sent = () => ({ state: 'idle', data: { sent: true } }) as Fetcher

/*
  One second at a time. Each tick schedules the next from inside an effect, so
  React has to render between them; advancing the whole span in one jump fires
  only the first timeout.
*/
function tick(seconds: number) {
	for (let i = 0; i < seconds; i++) {
		act(() => {
			vi.advanceTimersByTime(1000)
		})
	}
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useResendCooldown', () => {
	it('stays at zero until something is sent', () => {
		const probe = renderWith({ state: 'idle', data: undefined })

		expect(probe.remaining).toBe(0)
	})

	it('starts the cooldown when a send is accepted', () => {
		const probe = renderWith(sent())

		expect(probe.remaining).toBe(60)
	})

	/*
	  The defect. Two successful sends carry byte-identical bodies, so only
	  response identity distinguishes them - which is why a `wasSent` boolean
	  cannot, and why this fails against the code that shipped.
	*/
	it('restarts the cooldown on a second send carrying an identical body', () => {
		const probe = renderWith(sent())

		tick(5)
		expect(probe.remaining).toBe(55)

		probe.settle(sent())

		expect(probe.remaining).toBe(60)
	})

	it('counts down once per second', () => {
		const probe = renderWith(sent())

		tick(3)

		expect(probe.remaining).toBe(57)
	})

	/*
	  Bounds the interval from below as well. Asserting only that it ticks leaves
	  any interval under a second passing - at 1ms a sixty second cooldown drains
	  in sixty.
	*/
	it('has not ticked yet a millisecond before the second is up', () => {
		const probe = renderWith(sent())

		act(() => {
			vi.advanceTimersByTime(999)
		})

		expect(probe.remaining).toBe(60)
	})

	it('stops at zero rather than going negative', () => {
		const probe = renderWith(sent(), 2)

		tick(10)

		expect(probe.remaining).toBe(0)
	})

	/*
	  A submission that produces no new response still round-trips the state:
	  React Router carries the previous `data` through `submitting` and back to
	  `idle`, so the effect re-runs with the same object. Only the identity guard
	  stops that counting as a fresh send and handing out a new sixty seconds.

	  Re-rendering with `idle` alone would not test this - React skips the effect
	  when neither dependency changed, so the guard never runs and the test would
	  be pinning the dependency array instead.
	*/
	it('does not restart when a submission returns the same response object', () => {
		const response = { sent: true }
		const probe = renderWith({ state: 'idle', data: response })

		tick(4)
		probe.settle({ state: 'submitting', data: response })
		probe.settle({ state: 'idle', data: response })

		expect(probe.remaining).toBe(56)
	})

	/*
	  A rate limit locks the button too. Without this the fourth press in a
	  window answered "Too many requests" and then re-enabled as soon as a fresh
	  captcha token landed, which is the hole this hook exists to close.
	*/
	it('holds for as long as the server said when rate limited', () => {
		const probe = renderWith({
			state: 'idle',
			data: { rateLimited: true, retryAfterSeconds: 42 }
		})

		expect(probe.remaining).toBe(42)
	})

	it('falls back to the default hold when no retry-after is given', () => {
		const probe = renderWith({ state: 'idle', data: { rateLimited: true } })

		expect(probe.remaining).toBe(60)
	})

	it('ignores a response that reports nothing was sent', () => {
		const probe = renderWith({ state: 'idle', data: { sent: false } })

		expect(probe.remaining).toBe(0)
	})

	it('ignores a send that is still in flight', () => {
		const probe = renderWith({ state: 'submitting', data: { sent: true } })

		expect(probe.remaining).toBe(0)
	})
})
