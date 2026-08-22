// @vitest-environment jsdom
/**
 * The panel's fetch and create state.
 *
 * Two guards carry this hook, and both are the kind a later "simplification"
 * removes without anything going red: the ref that stops the key request
 * re-firing on every render, and the one that stops a create response being
 * applied twice. The rest is envelope reading - the difference between an
 * error surfacing and being swallowed.
 */

import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEmbedApiKeys } from '../app/components/embed/use-embed-api-keys'

import type { EmbedApiKeysApi } from '../app/components/embed/use-embed-api-keys'

const { load, submit, setUpgradeModal, fetchers } = vi.hoisted(() => ({
	load: vi.fn(),
	submit: vi.fn(),
	setUpgradeModal: vi.fn(),
	fetchers: [] as Array<{ state: string; data: unknown }>
}))

vi.mock('react-router', () => ({
	// Two `useFetcher()` calls per render, in a fixed order: list, then create.
	// A fresh object each time, which is exactly the identity churn the ref
	// guard in the hook exists to survive.
	useFetcher: vi.fn(() => {
		const index = callIndex++ % 2
		return index === 0
			? { load, state: fetchers[0].state, data: fetchers[0].data }
			: { submit, state: fetchers[1].state, data: fetchers[1].data }
	})
}))

vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))

vi.mock('jotai/react', () => ({ useSetAtom: () => setUpgradeModal }))

let callIndex = 0

/*
  Mounted under `StrictMode` deliberately. Both refs in this hook exist only to
  survive StrictMode's double-invoked effects - the dependency arrays already
  stop a plain re-render from re-firing anything - so a test that renders
  normally passes just as happily with both guards deleted. Rendering the way
  the app renders is what gives these assertions teeth.
*/
function mount(props: { projectId?: string; enabled: boolean }) {
	const seen: EmbedApiKeysApi[] = []

	function Probe(inner: typeof props) {
		seen.push(useEmbedApiKeys(inner))
		return null
	}

	const utils = render(
		<StrictMode>
			<Probe {...props} />
		</StrictMode>
	)

	return {
		latest: () => seen[seen.length - 1],
		rerender: (next: typeof props) =>
			utils.rerender(
				<StrictMode>
					<Probe {...next} />
				</StrictMode>
			)
	}
}

beforeEach(() => {
	callIndex = 0
	load.mockClear()
	submit.mockClear()
	setUpgradeModal.mockClear()
	fetchers[0] = { state: 'idle', data: undefined }
	fetchers[1] = { state: 'idle', data: undefined }
})

describe('loading the key list', () => {
	it('requests once, and not again on re-render or a repeated effect', () => {
		const probe = mount({ projectId: 'p1', enabled: true })

		expect(load).toHaveBeenCalledTimes(1)
		expect(load).toHaveBeenCalledWith('/api/projects/p1/api-keys')

		probe.rerender({ projectId: 'p1', enabled: true })
		probe.rerender({ projectId: 'p1', enabled: true })

		expect(load).toHaveBeenCalledTimes(1)
	})

	it('does not request until the scene has a project', () => {
		const probe = mount({ projectId: undefined, enabled: false })
		expect(load).not.toHaveBeenCalled()

		probe.rerender({ projectId: 'p1', enabled: true })
		expect(load).toHaveBeenCalledTimes(1)
	})

	it('requests again when the project changes', () => {
		const probe = mount({ projectId: 'p1', enabled: true })
		probe.rerender({ projectId: 'p2', enabled: true })

		expect(load.mock.calls.map(([url]) => url)).toEqual([
			'/api/projects/p1/api-keys',
			'/api/projects/p2/api-keys'
		])
	})

	it('reports nothing known before a response arrives', () => {
		/*
		  The state that produced this: `listFetcher.state` is `'idle'` both after
		  a request settles and before one is dispatched, and dispatch happens in
		  an effect - which never runs during server rendering. A flag derived
		  from `state` therefore says "not loading" in the SSR'd HTML, and every
		  empty-state message gated on it renders as fact about unfetched data.
		*/
		const probe = mount({ projectId: 'p1', enabled: true })

		expect(probe.latest().hasLoaded).toBe(false)
		expect(probe.latest().keys).toEqual([])
		expect(probe.latest().allowedDomains).toEqual([])
		expect(probe.latest().loadError).toBeNull()
	})

	it('knows an answer arrived, including a refusal', () => {
		fetchers[0] = { state: 'idle', data: { success: false, error: 'nope' } }
		expect(mount({ projectId: 'p1', enabled: true }).latest().hasLoaded).toBe(
			true
		)
	})

	it('surfaces a refusal instead of reporting an empty project', () => {
		fetchers[0] = {
			state: 'idle',
			data: { success: false, error: 'You do not have permission to view API keys' }
		}
		const probe = mount({ projectId: 'p1', enabled: true })

		expect(probe.latest().keys).toEqual([])
		expect(probe.latest().loadError).toBe(
			'You do not have permission to view API keys'
		)
	})

	it('reads the payload through the success envelope', () => {
		fetchers[0] = {
			state: 'idle',
			data: {
				success: true,
				data: {
					projectId: 'p1',
					projectName: 'Storefront',
					allowedDomains: ['shop.example.com'],
					keys: [{ id: 'k1', name: 'live', keyPreview: 'ab3x' }],
					canCreateKey: true
				}
			}
		}
		const api = mount({ projectId: 'p1', enabled: true }).latest()

		expect(api.keys).toHaveLength(1)
		expect(api.allowedDomains).toEqual(['shop.example.com'])
		expect(api.canCreateKey).toBe(true)
		expect(api.hasLoaded).toBe(true)
		expect(api.loadError).toBeNull()
	})
})

describe('creating a key', () => {
	it('posts the intent and the CSRF token to this project', () => {
		mount({ projectId: 'p1', enabled: true }).latest().createKey()

		expect(submit).toHaveBeenCalledWith(
			{ intent: 'create', csrf: 'csrf-token' },
			{ method: 'post', action: '/api/projects/p1/api-keys' }
		)
	})

	it('fills the token, selects the key, and refreshes the list', () => {
		const created = {
			success: true,
			data: {
				key: { id: 'new', name: 'Embed key', keyPreview: 'ab3x' },
				plaintext: 'vctrl_secretab3x'
			}
		}
		const probe = mount({ projectId: 'p1', enabled: true })
		expect(load).toHaveBeenCalledTimes(1)

		fetchers[1] = { state: 'idle', data: created }
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().token).toBe('vctrl_secretab3x')
		expect(probe.latest().createdPlaintext).toBe('vctrl_secretab3x')
		expect(probe.latest().selectedKeyId).toBe('new')
		expect(load).toHaveBeenCalledTimes(2)
	})

	it('applies a second key, rather than blocking everything after the first', () => {
		/*
		  The mount-time test above proves the identity guard *checks*. This one
		  proves it does not over-block: `if (handledCreateRef.current) return`
		  would swallow every key after the first, and three rerenders with
		  unchanged props - which is what stood here - cannot tell the difference,
		  because an unchanged dependency array never re-runs the effect either way.
		*/
		const response = (id: string, plaintext: string) => ({
			success: true,
			data: { key: { id, name: 'Embed key', keyPreview: 'ab3x' }, plaintext }
		})
		const probe = mount({ projectId: 'p1', enabled: true })

		fetchers[1] = { state: 'idle', data: response('first', 'vctrl_firstab3x') }
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))
		expect(probe.latest().token).toBe('vctrl_firstab3x')

		act(() => probe.latest().dismissCreatedKey())

		fetchers[1] = { state: 'idle', data: response('second', 'vctrl_second9zQ1') }
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().token).toBe('vctrl_second9zQ1')
		expect(probe.latest().selectedKeyId).toBe('second')
		expect(probe.latest().createdPlaintext).toBe('vctrl_second9zQ1')
	})

	it('applies a response already present at mount exactly once', () => {
		/*
		  The case the identity guard is actually for. A dependency array already
		  stops an unchanged response being re-applied on update, so the guard only
		  earns its place when the effect runs twice against the same data - which
		  is what a mount does under StrictMode, and what a remount does when the
		  publisher's accordion closes and reopens with the fetcher still holding
		  its result. Applying twice would fire a second list refresh.
		*/
		fetchers[1] = {
			state: 'idle',
			data: {
				success: true,
				data: {
					key: { id: 'new', name: 'Embed key', keyPreview: 'ab3x' },
					plaintext: 'vctrl_secretab3x'
				}
			}
		}

		const probe = mount({ projectId: 'p1', enabled: true })

		expect(probe.latest().token).toBe('vctrl_secretab3x')
		// The initial list load, plus exactly one refresh for the create.
		expect(load).toHaveBeenCalledTimes(2)
	})

	it('opens the upgrade prompt once for a refusal present at mount', () => {
		fetchers[1] = {
			state: 'idle',
			data: {
				success: false,
				error: 'API key limit reached for your plan.',
				quota: {
					limitKey: 'api_keys_per_org',
					currentValue: 3,
					limit: 3,
					plan: 'free',
					upgradeTo: 'pro'
				}
			}
		}

		mount({ projectId: 'p1', enabled: true })

		expect(setUpgradeModal).toHaveBeenCalledTimes(1)
	})

	it('forgets the plaintext once dismissed', () => {
		const probe = mount({ projectId: 'p1', enabled: true })
		fetchers[1] = {
			state: 'idle',
			data: {
				success: true,
				data: {
					key: { id: 'new', name: 'k', keyPreview: 'ab3x' },
					plaintext: 'vctrl_secretab3x'
				}
			}
		}
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		act(() => probe.latest().dismissCreatedKey())

		expect(probe.latest().createdPlaintext).toBeNull()
		// The token stays: the user still needs it to build a snippet.
		expect(probe.latest().token).toBe('vctrl_secretab3x')
	})

	it('opens the upgrade prompt on a quota refusal rather than a bare error', () => {
		const probe = mount({ projectId: 'p1', enabled: true })
		fetchers[1] = {
			state: 'idle',
			data: {
				success: false,
				error: 'API key limit reached for your plan.',
				quota: {
					limitKey: 'api_keys_per_org',
					currentValue: 3,
					limit: 3,
					plan: 'free',
					upgradeTo: 'pro'
				}
			}
		}
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(setUpgradeModal).toHaveBeenCalledTimes(1)
		// The modal is the message, so the inline notice must not double it.
		expect(probe.latest().createError).toBeNull()
	})

	it('still shows an inline error when there is no upgrade to offer', () => {
		const probe = mount({ projectId: 'p1', enabled: true })
		fetchers[1] = {
			state: 'idle',
			data: { success: false, error: 'Could not create an API key' }
		}
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(setUpgradeModal).not.toHaveBeenCalled()
		expect(probe.latest().createError).toBe('Could not create an API key')
	})
})
