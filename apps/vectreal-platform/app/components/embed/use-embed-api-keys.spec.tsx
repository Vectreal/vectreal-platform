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

import { useEmbedApiKeys } from './use-embed-api-keys'

import type { EmbedApiKeysApi } from './use-embed-api-keys'
import type { EmbedApiKeyOption } from '../../lib/domain/embed/embed-key-options'

const { load, submit, setUpgradeModal, fetchers } = vi.hoisted(() => ({
	load: vi.fn(),
	submit: vi.fn(),
	setUpgradeModal: vi.fn(),
	fetchers: [] as Array<{
		state: string
		data: unknown
		/** Scopes the fixture to one project, as a real fetcher key does. */
		projectId?: string
	}>
}))

vi.mock('react-router', () => ({
	/*
	  Keyed, like the real one. The hook asks for `embed-keys:<endpoint>` and
	  `embed-keys-create:<endpoint>`, and React Router hands back a fetcher with
	  no data whenever that key is new - which is the entire mechanism keeping
	  one project's answer off another's panel. A mock that ignored the key would
	  return the previous project's payload forever and every cross-project test
	  here would be asserting against nothing.

	  `projectId` on a fixture scopes it; a fixture without one answers to any
	  endpoint, which is what the single-project tests want.
	*/
	useFetcher: vi.fn(({ key }: { key: string }) => {
		const isCreate = key.startsWith('embed-keys-create:')
		const entry = fetchers[isCreate ? 1 : 0]
		const answers =
			entry.projectId === undefined ||
			key.endsWith(`/api/projects/${entry.projectId}/api-keys`)
		const view = answers
			? { state: entry.state, data: entry.data }
			: { state: 'idle', data: undefined }

		return isCreate ? { submit, ...view } : { load, ...view }
	})
}))

vi.mock('remix-utils/csrf/react', () => ({
	useAuthenticityToken: () => 'csrf-token'
}))

vi.mock('jotai/react', () => ({ useSetAtom: () => setUpgradeModal }))

/**
 * A key row shaped the way the route actually sends one.
 *
 * Spelled out rather than left partial, because `value`, `revoked` and
 * `expired` are what the hook now decides selection on: a fixture missing them
 * describes a row the loader cannot produce, and passes tests the real payload
 * would fail.
 */
const option = (
	overrides: Partial<EmbedApiKeyOption> = {}
): EmbedApiKeyOption =>
	({
		id: 'k1',
		name: 'Embed key',
		keyPreview: 'ab3x',
		value: 'vctrl_realkeyab3x',
		expiresAt: null,
		lastUsedAt: null,
		revoked: false,
		expired: false,
		...overrides
	}) satisfies EmbedApiKeyOption

const listPayload = (keys: EmbedApiKeyOption[], projectId = 'p1') => ({
	state: 'idle',
	projectId,
	data: {
		success: true,
		data: {
			projectId,
			projectName: 'Storefront',
			allowedDomains: ['shop.example.com'],
			keys,
			canCreateKey: true
		}
	}
})

const createPayload = (key: EmbedApiKeyOption) => ({
	state: 'idle',
	data: { success: true, data: { key, plaintext: key.value } }
})

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

		expect(probe.latest().hasAnswer).toBe(false)
		expect(probe.latest().keys).toEqual([])
		expect(probe.latest().allowedDomains).toEqual([])
		expect(probe.latest().loadError).toBeNull()
	})

	it('tells a refusal apart from silence', () => {
		fetchers[0] = { state: 'idle', data: { success: false, error: 'nope' } }
		const refused = mount({ projectId: 'p1', enabled: true }).latest()

		expect(refused.loadError).toBe('nope')
		expect(refused.hasAnswer).toBe(false)
	})

	it('surfaces a refusal instead of reporting an empty project', () => {
		fetchers[0] = {
			state: 'idle',
			data: {
				success: false,
				error: 'You do not have permission to view API keys'
			}
		}
		const probe = mount({ projectId: 'p1', enabled: true })

		expect(probe.latest().keys).toEqual([])
		expect(probe.latest().loadError).toBe(
			'You do not have permission to view API keys'
		)
	})

	it('separates "an answer arrived" from "the answer is usable"', () => {
		/*
		  `hasAnswer` is the flag every statement about keys and domains is gated
		  on, and the distinction it carries is the whole point: `hasLoaded` is
		  true for a refusal too, so a guard written against `hasLoaded` alone
		  tells a member who may not read keys that their project has none -
		  directly above the 403 saying they are not allowed to know.

		  Pinned here rather than in the component specs, which mock this hook:
		  dropping the `loadError === null` half left all seven of those green.
		*/
		const before = mount({ projectId: 'p1', enabled: true })
		expect(before.latest().hasAnswer).toBe(false)

		fetchers[0] = {
			state: 'idle',
			data: { success: false, error: 'You do not have permission' }
		}
		const refused = mount({ projectId: 'p2', enabled: true })
		expect(refused.latest().loadError).not.toBeNull()
		expect(refused.latest().hasAnswer).toBe(false)

		fetchers[0] = listPayload([], 'p3')
		const answered = mount({ projectId: 'p3', enabled: true })
		expect(answered.latest().hasAnswer).toBe(true)

		/*
		  And a fourth state the other three miss: a perfectly good answer about
		  the project we were looking at a moment ago.
		*/
		fetchers[0] = listPayload([], 'p3')
		const moved = mount({ projectId: 'p4', enabled: true })
		expect(moved.latest().loadError).toBeNull()
		expect(moved.latest().hasAnswer).toBe(false)
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
					keys: [option()],
					canCreateKey: true
				}
			}
		}
		const api = mount({ projectId: 'p1', enabled: true }).latest()

		expect(api.keys).toHaveLength(1)
		expect(api.allowedDomains).toEqual(['shop.example.com'])
		expect(api.canCreateKey).toBe(true)
		expect(api.hasAnswer).toBe(true)
		expect(api.loadError).toBeNull()
	})
})

describe('choosing which key builds the snippet', () => {
	/*
	  This whole family is new to Phase 2, and it is where the paste field went.
	  The token is derived from the selection now, so "which key is selected" and
	  "what the snippet says" are one decision rather than two that could
	  disagree - which is exactly what the deleted mismatch warning was for.
	*/
	it('takes the value from the selected key', () => {
		fetchers[0] = listPayload([option({ value: 'vctrl_fromtheloader' })])

		expect(mount({ projectId: 'p1', enabled: true }).latest().token).toBe(
			'vctrl_fromtheloader'
		)
	})

	it('skips past keys that cannot build a snippet', () => {
		/*
		  All three dead shapes ahead of the live one, in the order the sort would
		  never actually produce - so the guard is on the predicate, not on the
		  list happening to arrive usable-first.

		  The expired row is the one that matters most: it keeps its ciphertext, so
		  `value` reads back fine and a predicate written against `value` alone
		  selects it, builds a snippet that looks finished, and 404s at the embed.
		*/
		fetchers[0] = listPayload([
			option({ id: 'legacy', value: null }),
			option({ id: 'revoked', revoked: true, value: null }),
			option({ id: 'expired', expired: true }),
			option({ id: 'live' })
		])

		const api = mount({ projectId: 'p1', enabled: true }).latest()

		expect(api.selectedKeyId).toBe('live')
		expect(api.token).toBe('vctrl_realkeyab3x')
	})

	it('selects nothing, and offers no token, when no key works', () => {
		fetchers[0] = listPayload([
			option({ id: 'legacy', value: null }),
			option({ id: 'revoked', revoked: true, value: null })
		])

		const api = mount({ projectId: 'p1', enabled: true }).latest()

		expect(api.selectedKeyId).toBe('')
		expect(api.token).toBe('')
	})

	it('moves off a key that stops working under it', () => {
		/*
		  Revoked in another tab, or aged out between two loads. Without the
		  self-heal the panel keeps a selection the list no longer supports and
		  quietly serves a snippet built from a dead key.
		*/
		fetchers[0] = listPayload([option({ id: 'live' }), option({ id: 'spare' })])
		const probe = mount({ projectId: 'p1', enabled: true })
		expect(probe.latest().selectedKeyId).toBe('live')

		fetchers[0] = listPayload([
			option({ id: 'live', revoked: true, value: null }),
			option({ id: 'spare' })
		])
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().selectedKeyId).toBe('spare')
	})

	it('leaves a deliberate choice alone', () => {
		/*
		  The self-heal only fires when the current pick has stopped being
		  selectable. Written as "always take the first usable key" it would drag
		  the selection back to the top on every reload and there would be no way
		  to use the second key in the list.
		*/
		fetchers[0] = listPayload([option({ id: 'live' }), option({ id: 'spare' })])
		const probe = mount({ projectId: 'p1', enabled: true })

		act(() => probe.latest().selectKey('spare'))
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().selectedKeyId).toBe('spare')
	})
})

describe('recovering from a refused load', () => {
	it('asks again, and keeps asking on a second click', () => {
		/*
		  Every click has to reach the router. The load itself is latched per
		  endpoint by a ref so it fires once, and `retry` deliberately goes around
		  that rather than through it - a retry gated on the same ref would be a
		  dead click every time after the first.
		*/
		fetchers[0] = { state: 'idle', data: { success: false, error: 'Boom' } }
		const probe = mount({ projectId: 'p1', enabled: true })
		expect(load).toHaveBeenCalledTimes(1)

		act(() => probe.latest().retry())
		act(() => probe.latest().retry())

		expect(load).toHaveBeenCalledTimes(3)
		expect(load).toHaveBeenLastCalledWith('/api/projects/p1/api-keys')
	})

	it('reports the request as in flight, and only while it is', () => {
		/*
		  Both directions. Pinned true-only, `const loading = true` passes - and
		  that permanently disables the Retry button, reinstating the dead end it
		  was added to remove.
		*/
		fetchers[0] = { state: 'loading', data: { success: false, error: 'Boom' } }
		expect(mount({ projectId: 'p1', enabled: true }).latest().loading).toBe(
			true
		)

		fetchers[0] = { state: 'idle', data: { success: false, error: 'Boom' } }
		expect(mount({ projectId: 'p2', enabled: true }).latest().loading).toBe(
			false
		)
	})

	it('does not throw away a deliberate pick when the list goes unknown', () => {
		/*
		  `keys` is empty for a refused load too, and the selection effect used to
		  read that as "your key died". Any fetcher action elsewhere in the app
		  revalidates this list - the publisher autosaves - so one 401 cleared a
		  deliberate choice, and the retry then landed on the newest key instead.
		  The snippet changed under the user with nothing to show for it.
		*/
		fetchers[0] = listPayload([option({ id: 'old' }), option({ id: 'newest' })])
		const probe = mount({ projectId: 'p1', enabled: true })

		act(() => probe.latest().selectKey('old'))
		expect(probe.latest().selectedKeyId).toBe('old')

		// A revalidation somewhere else in the app comes back refused.
		fetchers[0] = { state: 'idle', data: { success: false, error: 'Boom' } }
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		/*
		  Nothing is reported as selected, because there is no list to be selected
		  from and a `Select` pointing at an absent item renders a blank trigger
		  rather than its placeholder.
		*/
		expect(probe.latest().selectedKeyId).toBe('')

		// And the pick comes back when the list does - it was never cleared.
		fetchers[0] = listPayload([option({ id: 'old' }), option({ id: 'newest' })])
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().selectedKeyId).toBe('old')
	})

	it('keeps one project error off the next project controls', () => {
		/*
		  `payload` is gated on the project id the route echoes back, but an error
		  envelope carries no project - so a refused load for A went on replacing
		  B's picker and Create button with A's notice for the whole of B's
		  request.
		*/
		fetchers[0] = {
			state: 'idle',
			data: { success: false, error: 'Boom' },
			projectId: 'p1'
		}
		const probe = mount({ projectId: 'p1', enabled: true })
		expect(probe.latest().loadError).toBe('Boom')

		act(() => probe.rerender({ projectId: 'p2', enabled: true }))

		expect(probe.latest().loadError).toBeNull()
		expect(probe.latest().hasAnswer).toBe(false)
	})
})

describe('an answer about the wrong project is not an answer', () => {
	/*
	  `endpoint` changes the moment `projectId` does and the load re-fires, but the
	  fetcher keeps the previous project's payload until the new one lands. That
	  window reported `hasAnswer` for a project the user had already left: A's
	  domains and A's keys rendered under B's scene, A's key stayed selected
	  because it was still in the list and still usable, and the panel offered a
	  Copy button for `/embed/<B>/<sceneB>?token=<A's key>` - finished-looking, and
	  a 404 on every site.

	  The route has always put `projectId` on the payload. Nothing read it.
	*/
	it('reports nothing while the previous project is still in the fetcher', () => {
		fetchers[0] = listPayload([option({ id: 'a-key' })], 'p1')
		const probe = mount({ projectId: 'p1', enabled: true })
		expect(probe.latest().hasAnswer).toBe(true)

		act(() => probe.rerender({ projectId: 'p2', enabled: true }))

		expect(probe.latest().hasAnswer).toBe(false)
		expect(probe.latest().keys).toEqual([])
		expect(probe.latest().allowedDomains).toEqual([])
		expect(probe.latest().token).toBe('')
	})

	it('does not carry a key minted for one project into the next', () => {
		/*
		  Held as a bare option, the optimistic row outlived its project: the
		  refreshed list never contains that id again, so it sat at the top of the
		  next project's picker, usable and auto-selected, with the wrong value.
		*/
		fetchers[0] = listPayload([], 'p1')
		const probe = mount({ projectId: 'p1', enabled: true })

		fetchers[1] = createPayload(option({ id: 'minted-for-p1' }))
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))
		expect(probe.latest().keys.map((key) => key.id)).toEqual(['minted-for-p1'])

		fetchers[0] = listPayload([option({ id: 'p2-key' })], 'p2')
		act(() => probe.rerender({ projectId: 'p2', enabled: true }))

		expect(probe.latest().keys.map((key) => key.id)).toEqual(['p2-key'])
	})

	it('drops the minted key the moment the project changes, not when the next list lands', () => {
		/*
		  The window the stamp alone does not close, and the one that matters: the
		  project changes before the follow-up list returns, so `listFetcher.data`
		  has NOT moved on and the stamp still matches. `payload` is correctly
		  null, `fetched` is empty, and without the payload check the merge kept
		  the row - so project B's scene offered a finished, copyable snippet
		  carrying project A's token, with `ready` true and Copy enabled.
		*/
		fetchers[0] = listPayload([], 'p1')
		const probe = mount({ projectId: 'p1', enabled: true })

		fetchers[1] = createPayload(option({ id: 'minted-for-p1' }))
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))
		expect(probe.latest().token).toBe('vctrl_realkeyab3x')

		// Project changes; A's list response is still the one in hand.
		act(() => probe.rerender({ projectId: 'p2', enabled: true }))

		expect(probe.latest().keys).toEqual([])
		expect(probe.latest().token).toBe('')
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

	it('makes the new key usable before the list reload lands', () => {
		/*
		  The create response carries the whole option, value included, so the
		  snippet can be ready in the same commit as the button's own state change
		  rather than a round trip later. Without the optimistic insert the key
		  exists, is selected, and yields nothing to copy until the refresh
		  returns.
		*/
		fetchers[0] = listPayload([])
		const probe = mount({ projectId: 'p1', enabled: true })
		expect(load).toHaveBeenCalledTimes(1)

		fetchers[1] = createPayload(
			option({ id: 'new', value: 'vctrl_secretab3x' })
		)
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().keys.map((key) => key.id)).toEqual(['new'])
		expect(probe.latest().selectedKeyId).toBe('new')
		expect(probe.latest().token).toBe('vctrl_secretab3x')
		expect(load).toHaveBeenCalledTimes(2)
	})

	it('selects the key it just minted, even when one was already chosen', () => {
		/*
		  The common path, and the one every other create test missed by starting
		  from an empty list: the project already has a working key, the selection
		  effect has auto-selected it, and the effect only moves when a pick stops
		  being usable. So minting a second key changed nothing on screen - the
		  button went back to "Create a key", the snippet still carried the old
		  key, and a quota had been spent invisibly.
		*/
		fetchers[0] = listPayload([option({ id: 'existing' })])
		const probe = mount({ projectId: 'p1', enabled: true })
		expect(probe.latest().selectedKeyId).toBe('existing')

		fetchers[1] = createPayload(
			option({ id: 'fresh', value: 'vctrl_freshab3x' })
		)
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().selectedKeyId).toBe('fresh')
		expect(probe.latest().token).toBe('vctrl_freshab3x')
	})

	it('does not list the new key twice once the reload arrives', () => {
		/*
		  Merged by id rather than appended. The refreshed list contains the key
		  the create response already put there, and two rows for one key in a
		  picker is a choice between identical options.
		*/
		fetchers[0] = listPayload([])
		const probe = mount({ projectId: 'p1', enabled: true })

		fetchers[1] = createPayload(option({ id: 'new' }))
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		fetchers[0] = listPayload([option({ id: 'new' })])
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().keys.map((key) => key.id)).toEqual(['new'])
	})

	it('applies a second key, rather than blocking everything after the first', () => {
		/*
		  The mount-time test above proves the identity guard *checks*. This one
		  proves it does not over-block: `if (handledCreateRef.current) return`
		  would swallow every key after the first, and three rerenders with
		  unchanged props - which is what stood here - cannot tell the difference,
		  because an unchanged dependency array never re-runs the effect either way.
		*/
		fetchers[0] = listPayload([])
		const probe = mount({ projectId: 'p1', enabled: true })

		fetchers[1] = createPayload(
			option({ id: 'first', value: 'vctrl_firstab3x' })
		)
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))
		expect(probe.latest().token).toBe('vctrl_firstab3x')

		fetchers[1] = createPayload(
			option({ id: 'second', value: 'vctrl_second9zQ1' })
		)
		act(() => probe.rerender({ projectId: 'p1', enabled: true }))

		expect(probe.latest().selectedKeyId).toBe('second')
		expect(probe.latest().token).toBe('vctrl_second9zQ1')
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
		fetchers[0] = listPayload([])
		fetchers[1] = createPayload(
			option({ id: 'new', value: 'vctrl_secretab3x' })
		)

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
