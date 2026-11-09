// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import {
	deferPostHog,
	PostHogProvider,
	useFeatureFlagEnabled
} from './posthog-react'
import {
	ConsentProvider,
	useConsent
} from '../../components/consent/consent-context'

import type { PostHog } from 'posthog-js'

/*
  The library arrives after hydration (`posthog-browser.ts`), so a page's
  first calls happen before it exists.
*/
function deferred() {
	let resolve: (client: PostHog) => void = () => {}
	const promise = new Promise<PostHog>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

function fakeLibrary() {
	const calls: Array<[string, unknown[]]> = []
	const record =
		(name: string) =>
		(...args: unknown[]) =>
			calls.push([name, args])
	const posthog = {
		capture: record('capture'),
		opt_in_capturing: record('opt_in_capturing'),
		reset: record('reset')
	} as unknown as PostHog
	return { posthog, calls }
}

describe('deferPostHog', () => {
	it('replays calls made before the library loaded, in order', async () => {
		const { posthog, calls } = fakeLibrary()
		const { promise, resolve } = deferred()
		const { client, loaded } = deferPostHog(promise)

		client.opt_in_capturing()
		client.capture('$pageview', { a: 1 })
		client.reset()
		expect(calls).toEqual([])

		resolve(posthog)
		await loaded

		expect(calls.map(([name]) => name)).toEqual([
			'opt_in_capturing',
			'capture',
			'reset'
		])
		expect(calls[1][1][1]).toMatchObject({ a: 1 })
	})

	// A visitor who navigates before the library arrives.
	it('sends a queued event with the page and time it was captured at', async () => {
		const { posthog, calls } = fakeLibrary()
		const { promise, resolve } = deferred()
		const { client, loaded } = deferPostHog(promise)
		window.history.pushState({}, '', '/news-room/first')
		const before = Date.now()

		client.capture('$pageview', { kept: true })
		window.history.pushState({}, '', '/news-room/second')
		resolve(posthog)
		await loaded

		const [, [event, properties, options]] = calls[0] as [
			string,
			[string, Record<string, unknown>, { timestamp: Date }]
		]
		expect(event).toBe('$pageview')
		expect(properties).toMatchObject({
			$pathname: '/news-room/first',
			kept: true
		})
		expect(options.timestamp.getTime()).toBeGreaterThanOrEqual(before)
	})

	it('replays the rest of the queue when one call throws', async () => {
		const { posthog, calls } = fakeLibrary()
		;(posthog as unknown as Record<string, unknown>).set_config = () => {
			throw new Error('SecurityError')
		}
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		const { promise, resolve } = deferred()
		const { client, loaded } = deferPostHog(promise)

		client.set_config({ persistence: 'localStorage+cookie' })
		client.opt_in_capturing()
		resolve(posthog)
		await loaded

		expect(calls.map(([name]) => name)).toEqual(['opt_in_capturing'])
		error.mockRestore()
	})

	it('calls the library directly once it has loaded', async () => {
		const { posthog, calls } = fakeLibrary()
		const { client, loaded } = deferPostHog(Promise.resolve(posthog))
		await loaded

		client.capture('later')

		expect(calls).toEqual([['capture', ['later']]])
	})

	// `/embed`, the switch off, or a failed load: nothing to send to, and
	// nothing kept.
	it('does nothing where PostHog never starts', async () => {
		const { client, loaded } = deferPostHog(Promise.resolve(undefined))
		client.capture('before')
		await loaded

		expect(() => client.capture('after')).not.toThrow()
	})
})

describe('useFeatureFlagEnabled', () => {
	function Flag() {
		const enabled = useFeatureFlagEnabled('billing-checkout')
		return <span>{String(enabled)}</span>
	}

	it('is undefined until PostHog loads, then follows the flag', async () => {
		let notify = () => {}
		let enabled = false
		const client = {
			isFeatureEnabled: vi.fn(() => enabled),
			onFeatureFlags: vi.fn((callback: () => void) => {
				notify = callback
				return () => {}
			})
		} as unknown as PostHog
		const { promise, resolve } = deferred()

		render(
			<PostHogProvider client={promise}>
				<Flag />
			</PostHogProvider>
		)
		expect(screen.getByText('undefined')).toBeInTheDocument()

		await act(async () => resolve(client))
		expect(screen.getByText('false')).toBeInTheDocument()

		enabled = true
		act(() => notify())
		expect(screen.getByText('true')).toBeInTheDocument()
	})
})

describe('ConsentProvider', () => {
	function Accept() {
		const { saveConsent } = useConsent()
		return (
			<button
				onClick={() =>
					saveConsent({ functional: false, analytics: true, marketing: false })
				}
			>
				accept
			</button>
		)
	}

	// Accepted in the second before the library finished downloading.
	it('opts a client in that arrives after the visitor accepted', async () => {
		const client = {
			set_config: vi.fn(),
			opt_in_capturing: vi.fn(),
			opt_out_capturing: vi.fn(),
			capture: vi.fn()
		} as unknown as PostHog & {
			opt_in_capturing: ReturnType<typeof vi.fn>
			capture: ReturnType<typeof vi.fn>
		}
		const { promise, resolve } = deferred()
		const Stub = createRoutesStub([
			{
				path: '/',
				Component: () => (
					<ConsentProvider>
						<Accept />
					</ConsentProvider>
				)
			},
			{ path: '/api/consent', action: () => ({ ok: true }) }
		])

		render(
			<PostHogProvider client={promise}>
				<Stub initialEntries={['/']} />
			</PostHogProvider>
		)
		act(() => screen.getByText('accept').click())
		expect(client.opt_in_capturing).not.toHaveBeenCalled()

		await act(async () => resolve(client))

		await waitFor(() => expect(client.opt_in_capturing).toHaveBeenCalled())
		// Opted in first, or the acceptance event itself is dropped.
		expect(client.capture).toHaveBeenCalledWith(
			'cookie_consent_accepted',
			expect.anything(),
			expect.anything()
		)
		expect(client.opt_in_capturing.mock.invocationCallOrder[0]).toBeLessThan(
			client.capture.mock.invocationCallOrder[0]
		)
	})
})
