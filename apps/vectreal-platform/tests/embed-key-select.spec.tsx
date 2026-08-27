// @vitest-environment jsdom
/**
 * What the key control is allowed to say, and to whom.
 *
 * Two families of guard. The first is the suffix a row carries, which is an
 * instruction: a key labelled "rotate to use" sends its owner to
 * `rotateApiKey`, and that throws for anything not active - so putting the
 * label on a revoked key sends them to an action that cannot work.
 *
 * The second is the one this panel has got wrong four separate times: zero
 * results read as "confirmed empty" rather than "not known yet". A member who
 * may open this panel but may not read keys gets a refused request, which looks
 * from here exactly like a project with no keys, and was told their project had
 * none directly above the 403 saying they are not allowed to know.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	describeKeyOption,
	EmbedKeySelect
} from '../app/components/embed/embed-key-select'
import { DASHBOARD_OPERATION_ROLES } from '../app/lib/domain/dashboard/dashboard-operations'
import { isEmbedKeyUsable } from '../app/lib/domain/embed/embed-key-options'
import { EMBED_COPY } from '../app/lib/domain/embed/embed-snippet'

import type { EmbedApiKeysApi } from '../app/components/embed/use-embed-api-keys'
import type { EmbedApiKeyOption } from '../app/lib/domain/embed/embed-key-options'

/*
  Radix needs three browser APIs jsdom does not ship before a `Select` will
  open. Without them the listbox cannot be rendered in a test at all, which is
  why `describeKeyOption`'s output went unasserted where it is actually used.
*/
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const OPTION: EmbedApiKeyOption = {
	id: 'key-1',
	name: 'Embed key for Demo',
	keyPreview: 'ab3x',
	value: 'vctrl_realkeyab3x',
	expiresAt: null,
	lastUsedAt: null,
	revoked: false,
	expired: false
}

let api: EmbedApiKeysApi

/**
 * A fixture that cannot describe a state the hook never produces.
 *
 * `hasAnswer` cannot be true alongside a `loadError`, and `token` cannot be a
 * value from a key that is not usable. Both are forced here rather than set,
 * because as plain fields they survive `{...api, loadError: '...'}` unchanged -
 * and every test of a refused load would then assert against a payload claiming
 * both to have failed and to be known, which is the state these tests exist to
 * rule out.
 *
 * The other fields are free on purpose: `canCreateKey: true` alongside
 * `hasAnswer: false` is not a payload the hook produces, but the tests that do
 * it are proving an early return fires *before* anything reads it, which is
 * stronger than leaning on the field being false.
 */
function apiWith(overrides: Partial<EmbedApiKeysApi> = {}): EmbedApiKeysApi {
	const merged = { ...api, ...overrides }
	const selected = merged.keys.find((key) => key.id === merged.selectedKeyId)

	return {
		...merged,
		hasAnswer: merged.hasAnswer && merged.loadError === null,
		/*
		  Gated on `isEmbedKeyUsable`, exactly as the hook gates it. Written as
		  `selected?.value ?? ''` this handed out a token for a revoked or expired
		  selection - a payload the hook cannot produce - and the docblock above
		  claimed fidelity it did not have.
		*/
		token:
			selected && isEmbedKeyUsable(selected) ? (selected.value ?? '') : ''
	}
}

beforeEach(() => {
	api = {
		keys: [],
		allowedDomains: [],
		canCreateKey: true,
		loadError: null,
		hasAnswer: true,
		token: '',
		selectedKeyId: '',
		selectKey: vi.fn(),
		createKey: vi.fn(),
		creating: false,
		createError: null,
		retry: vi.fn(),
		loading: false
	}
})

const picker = () => screen.queryByRole('combobox')
const createButton = () =>
	screen.queryByRole('button', { name: EMBED_COPY.createKey })

describe('what a row tells you to do about it', () => {
	/*
	  Asserted on the pure function here, and on the rendered listbox further
	  down. Both are needed: these four pass unchanged while the JSX renders
	  `option.name` and ignores `disabled`, which is what it did until the
	  listbox tests were written.
	*/
	it('tells you a revoked key is revoked, never to rotate it', () => {
		/*
		  `revokeApiKey` clears the stored value, so a revoked row is also
		  value-less - and reading `value` first would label it "rotate to use".
		  `rotateApiKey` throws for anything not active. The instruction would send
		  its owner to an action that cannot succeed; a revoked key is replaced.
		*/
		const { suffix, disabled } = describeKeyOption({
			...OPTION,
			revoked: true,
			value: null
		})

		expect(suffix).toBe(EMBED_COPY.keyRevokedSuffix)
		expect(disabled).toBe(true)
	})

	it('refuses an expired key even though its value reads back fine', () => {
		/*
		  The state no amount of looking at `value` will catch: an aged-out key
		  keeps its ciphertext, so it decrypts, looks selectable, builds a snippet
		  that looks finished - and 404s at the embed, because `isApiKeyLive`
		  refuses it.
		*/
		const { suffix, disabled } = describeKeyOption({
			...OPTION,
			expired: true
		})

		expect(suffix).toBe(EMBED_COPY.keyExpiredSuffix)
		expect(disabled).toBe(true)
	})

	it('offers rotation only for the live key whose value cannot be read', () => {
		/*
		  By elimination the third case: a row predating `encrypted_key`, or one
		  whose ciphertext no longer decrypts. Rotation is the way back for this
		  one and only this one. Every key in the local database is here.
		*/
		const { suffix, disabled } = describeKeyOption({ ...OPTION, value: null })

		expect(suffix).toBe(EMBED_COPY.keyRotateSuffix)
		expect(disabled).toBe(true)
	})

	it('reads expiry ahead of the missing value, not after it', () => {
		/*
		  The half of the order nothing pinned: no fixture was both expired and
		  value-less, so swapping those two branches stayed green - and that swap
		  is the one the docblock calls the 404-at-the-embed case. A revoked key
		  reaching this state is the same question one rung up.
		*/
		expect(
			describeKeyOption({ ...OPTION, expired: true, value: null }).suffix
		).toBe(EMBED_COPY.keyExpiredSuffix)

		expect(
			describeKeyOption({
				...OPTION,
				revoked: true,
				expired: true,
				value: null
			}).suffix
		).toBe(EMBED_COPY.keyRevokedSuffix)
	})

	it('leaves a usable key unqualified and selectable', () => {
		const { name, suffix, disabled } = describeKeyOption(OPTION)

		expect(name).toBe(`${OPTION.name} ...${OPTION.keyPreview}`)
		expect(suffix).toBeNull()
		expect(disabled).toBe(false)
	})
})

describe('what it says before it knows', () => {
	it('renders a disabled picker and claims nothing', () => {
		render(<EmbedKeySelect api={apiWith({ hasAnswer: false })} />)

		expect(picker()).toHaveProperty('disabled', true)
		expect(screen.queryByText(EMBED_COPY.keyNoneUsable)).toBeNull()
	})

	it('replaces the control with the error when the keys are refused', () => {
		/*
		  Replaces, not sits beneath. A disabled empty picker and a create button
		  under a 403 are three affordances narrating access this member does not
		  have.
		*/
		render(
			<EmbedKeySelect
				api={apiWith({
					loadError: 'You do not have permission to view API keys'
				})}
			/>
		)

		expect(
			screen.getByText('You do not have permission to view API keys')
		).not.toBeNull()
		expect(picker()).toBeNull()
		expect(createButton()).toBeNull()
	})
})

describe('what it says about an empty project', () => {
	it('offers the one control that helps, and no sentence', () => {
		/*
		  Nothing to pick from, so no picker - and no line explaining that, because
		  the button beside it is the whole next step. There is deliberately no
		  copy for "empty and you may not create either": `api-key:read` and
		  `api-key:create` carry the same roles, so an answer arriving at all means
		  this button is rendered.
		*/
		render(<EmbedKeySelect api={apiWith()} />)

		expect(picker()).toBeNull()
		expect(createButton()).not.toBeNull()
		expect(screen.queryByText(EMBED_COPY.keyNoneUsable)).toBeNull()
	})
})

describe('the invariant the empty state rests on', () => {
	it('lets anyone who can read a project key also create one', () => {
		/*
		  There is deliberately no "this project has no keys yet" copy for a member
		  who cannot create one, because that state cannot happen: an answer
		  arriving at all means `api-key:read` passed, and the two operations carry
		  the same roles. That is an invariant in another module, so it is pinned
		  here rather than left in a comment - narrow `api-key:create` and this
		  goes red, naming the copy that has to come back.
		*/
		/*
		  A subset, not an equality: what the copy decision needs is that anyone
		  who can read can also create. `toEqual` additionally fails on a
		  reordering, which would be a false alarm.
		*/
		expect(
			DASHBOARD_OPERATION_ROLES['api-key:read'].every((role) =>
				DASHBOARD_OPERATION_ROLES['api-key:create'].includes(role)
			)
		).toBe(true)
	})
})

describe('a refused load is not a dead end', () => {
	it('offers a retry that asks again', () => {
		/*
		  The list request is latched per endpoint by a ref, so without a control
		  here a transient 500 or a rotated session ends the panel: the notice
		  stands and nothing on screen can ask again.
		*/
		const retry = vi.fn()
		render(<EmbedKeySelect api={apiWith({ loadError: 'Boom', retry })} />)

		fireEvent.click(screen.getByRole('button', { name: EMBED_COPY.retry }))

		expect(retry).toHaveBeenCalledTimes(1)
	})

	it('goes pending while the request is out', () => {
		/*
		  React Router keeps the failed `data` for the whole re-load, so
		  `loadError` stays set and the notice cannot change. Without a state on
		  the button, nothing at all told the user the click registered - and each
		  click aborts the previous request, so an impatient one prevents it
		  finishing.
		*/
		render(
			<EmbedKeySelect api={apiWith({ loadError: 'Boom', loading: true })} />
		)

		const button = screen.getByRole('button', {
			name: EMBED_COPY.retryPending
		})

		expect(button).toHaveProperty('disabled', true)
	})
})

describe('what the listbox actually renders', () => {
	/*
	  The gap every other test in this file left open. `describeKeyOption` is
	  pure and was asserted directly, but its only consumer is inside
	  `SelectContent`, which Radix does not mount while the select is closed - so
	  rendering `option.name` and dropping `disabled` entirely kept the whole
	  suite green. These open it.
	*/
	const openListbox = () => {
		/*
		  By keyboard. Radix's `Select` opens on pointerdown only for a real
		  pointer event carrying a `pointerType`, which jsdom does not synthesize;
		  `ArrowDown` is in its `OPEN_KEYS` and needs nothing jsdom lacks.
		*/
		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' })

		return screen.getByRole('listbox')
	}

	it('carries the reason for a row into the row you can see', () => {
		render(
			<EmbedKeySelect
				api={apiWith({
					keys: [
						{ ...OPTION, id: 'live' },
						{ ...OPTION, id: 'legacy', value: null },
						{ ...OPTION, id: 'gone', revoked: true, value: null },
						{ ...OPTION, id: 'old', expired: true }
					],
					selectedKeyId: 'live'
				})}
			/>
		)

		const rows = within(openListbox()).getAllByRole('option')

		expect(rows.map((row) => row.textContent)).toEqual([
			OPTION.name + ' ...' + OPTION.keyPreview,
			`${OPTION.name} ...${OPTION.keyPreview}(${EMBED_COPY.keyRotateSuffix})`,
			`${OPTION.name} ...${OPTION.keyPreview}(${EMBED_COPY.keyRevokedSuffix})`,
			`${OPTION.name} ...${OPTION.keyPreview}(${EMBED_COPY.keyExpiredSuffix})`
		])
	})

	it('disables every row that cannot build a snippet', () => {
		render(
			<EmbedKeySelect
				api={apiWith({
					keys: [
						{ ...OPTION, id: 'live' },
						{ ...OPTION, id: 'legacy', value: null },
						{ ...OPTION, id: 'gone', revoked: true, value: null },
						{ ...OPTION, id: 'old', expired: true }
					],
					selectedKeyId: 'live'
				})}
			/>
		)

		const rows = within(openListbox()).getAllByRole('option')

		expect(
			rows.map((row) => row.getAttribute('aria-disabled') === 'true')
		).toEqual([false, true, true, true])
	})
})

describe('a failed create says something a user can act on', () => {
	it('does not put the server own error message on screen', () => {
		/*
		  The route returns `error.message` for anything that is an `Error`, so
		  rendering `createError` verbatim showed whatever threw. Its own route
		  spec throws `new Error('database is down')`; other reachable messages
		  name an organization the reader may not be able to see. None of them
		  describe an action this panel offers.
		*/
		render(
			<EmbedKeySelect api={apiWith({ createError: 'database is down' })} />
		)

		expect(screen.getByText(EMBED_COPY.createKeyFailure)).not.toBeNull()
		expect(screen.queryByText(/database is down/)).toBeNull()
	})
})

describe('what it says about keys it cannot use', () => {
	it('keeps the dead ones listed and says once that none work', () => {
		/*
		  Listed rather than filtered out: an embed that worked yesterday and 404s
		  today names a key in its URL, and a picker that hides revoked and expired
		  keys leaves the owner comparing a working key against an empty list.

		  Said once, above the list, because every row already carries its own
		  reason.
		*/
		render(
			<EmbedKeySelect
				api={apiWith({
					keys: [
						{ ...OPTION, id: 'a', revoked: true, value: null },
						{ ...OPTION, id: 'b', value: null }
					]
				})}
			/>
		)

		expect(picker()).not.toBeNull()
		expect(screen.getByText(EMBED_COPY.keyNoneUsable)).not.toBeNull()
	})

	it('says nothing of the sort once one key works', () => {
		render(
			<EmbedKeySelect
				api={apiWith({
					keys: [OPTION, { ...OPTION, id: 'b', revoked: true, value: null }],
					selectedKeyId: OPTION.id
				})}
			/>
		)

		expect(screen.queryByText(EMBED_COPY.keyNoneUsable)).toBeNull()
	})
})
