// @vitest-environment jsdom
/**
 * The dialog that hands a freshly minted key to its owner.
 *
 * What this file no longer asserts is the point of it. It used to guard a
 * `window.confirm` on dismissal, an Escape key deliberately disabled so that
 * question could not be skipped, and a two-flag copied state that existed only
 * to answer it. All three protected a value that `encrypted_key` makes
 * recoverable and that the API keys list now shows outright, so they were
 * deleted rather than reworded.
 *
 * Two things survived the redesign and are still guarded here: a second key
 * must not inherit the first one's checkmark - repeating a rotation is two
 * clicks, well inside the confirmation window, and the parent never remounts
 * this component - and the plaintext must stay out of session replay.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OneTimeKeyDialog, type OneTimeKeyValue } from './one-time-key-dialog'

const FIRST: OneTimeKeyValue = {
	plaintext: 'vctrl_firstsecretab3x',
	name: 'Storefront key',
	recoverable: true
}

const EXPIRES_AT = '2026-11-20T00:00:00.000Z'

const SECOND: OneTimeKeyValue = {
	plaintext: 'vctrl_secondsecret9zQ1',
	name: 'Storefront key',
	recoverable: true
}

const writeText = vi.fn(async () => undefined)

beforeEach(() => {
	vi.stubGlobal('navigator', { clipboard: { writeText } })
	writeText.mockClear()
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('OneTimeKeyDialog', () => {
	it('shows nothing until a key exists', () => {
		render(
			<OneTimeKeyDialog open apiKey={null} reason="created" onClose={vi.fn()} />
		)

		expect(screen.queryByText(FIRST.plaintext)).toBeNull()
	})

	it('shows the key and copies it', async () => {
		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={vi.fn()}
			/>
		)

		expect(screen.getByText(FIRST.plaintext)).not.toBeNull()

		fireEvent.click(screen.getByRole('button', { name: /copy api key/i }))
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(FIRST.plaintext))
	})

	it('closes without asking anything', () => {
		const confirm = vi.spyOn(window, 'confirm')
		const onClose = vi.fn()

		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={onClose}
			/>
		)

		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(
			confirm,
			'the value is recoverable, so dismissing it must not interrogate anyone'
		).not.toHaveBeenCalled()
		expect(onClose).toHaveBeenCalledOnce()
	})

	it('closes on Escape', () => {
		/*
		  Escape used to be swallowed so it could not slip past the copy check.
		  With the check gone, a dialog that ignores Escape is just a dialog that
		  breaks the one shortcut every other dialog in the app honours.
		*/
		const onClose = vi.fn()

		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={onClose}
			/>
		)

		fireEvent.keyDown(document.activeElement ?? document.body, {
			key: 'Escape',
			code: 'Escape'
		})

		expect(onClose).toHaveBeenCalled()
	})

	/*
	  The regression this file exists for. The parent renders this component
	  continuously and only swaps `apiKey`, so nothing remounts it between keys
	  and the confirmation window survives the swap. Keying the copy on the
	  plaintext is what breaks the inheritance; keying it on anything constant
	  brings the bug straight back.
	*/
	it('does not let a second key inherit the first key’s copied state', async () => {
		const { rerender } = render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="rotated"
				onClose={vi.fn()}
			/>
		)

		fireEvent.click(screen.getByRole('button', { name: /copy api key/i }))
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(FIRST.plaintext))
		await screen.findByRole('button', { name: /api key copied/i })

		// A second rotation, well within the confirmation window.
		rerender(
			<OneTimeKeyDialog
				open
				apiKey={SECOND}
				reason="rotated"
				onClose={vi.fn()}
			/>
		)
		await screen.findByText(SECOND.plaintext)

		expect(
			screen.getByRole('button', { name: /copy api key/i }),
			'the second key was never copied, so its button must not read as copied'
		).not.toBeNull()
	})

	it('tells a rotating user that the old key is already dead', () => {
		/*
		  The one warning left, and the only one that was ever about something
		  irreversible: rotation refuses the previous secret immediately, so every
		  embed still carrying it is broken until someone updates it.
		*/
		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="rotated"
				onClose={vi.fn()}
			/>
		)

		expect(screen.getByText(/previous key stopped working/i)).not.toBeNull()
		expect(screen.getByText(/every embed still carrying it/i)).not.toBeNull()
	})

	it('does not tell a creating user anything about a previous key', () => {
		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={vi.fn()}
			/>
		)

		expect(screen.queryByText(/previous key stopped working/i)).toBeNull()
	})

	it('promises the key can be seen again, rather than warning it cannot', () => {
		/*
		  Asserted as a positive claim, because the negative version of this test -
		  four `queryByText(...).toBeNull()` calls for the phrases that used to be
		  here - had no production line that could turn it red. It would only ever
		  have failed on someone re-adding those exact words.

		  This sentence is also the load-bearing half of the change: it is the
		  promise the API keys page now has to keep.
		*/
		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={vi.fn()}
			/>
		)

		expect(
			screen.getByText(/see it again on the api keys page/i)
		).not.toBeNull()
		expect(screen.queryByText(/secure location/i)).toBeNull()
	})

	it('warns instead when the key really cannot be shown again', () => {
		/*
		  `embed-token-cipher.server.ts` returns null rather than throwing when
		  `EMBED_TOKEN_ENCRYPTION_KEY` is unset, so a mint can succeed and store
		  nothing readable. On that deployment the recall promise is false, and
		  someone who trusts it and closes without copying has lost a working key -
		  which is the one loss the warning this dialog used to carry was really
		  protecting against.
		*/
		render(
			<OneTimeKeyDialog
				open
				apiKey={{ ...FIRST, recoverable: false }}
				reason="created"
				onClose={vi.fn()}
			/>
		)

		expect(screen.getByText(/cannot be shown again/i)).not.toBeNull()
		expect(screen.queryByText(/see it again on the api keys page/i)).toBeNull()
		expect(screen.getByText(/secure location/i)).not.toBeNull()
	})

	it('reports the copy on the control itself, then takes it back', async () => {
		/*
		  The checkmark is the only feedback the copy gives, and it reverts after
		  `CONFIRMATION_MS` so the button reads as pressable again. Nothing else in
		  this file looks at it: with the label held constant, the copied state
		  could be deleted outright and every other test here would still pass.
		*/
		vi.useFakeTimers({ shouldAdvanceTime: true })
		try {
			render(
				<OneTimeKeyDialog
					open
					apiKey={FIRST}
					reason="created"
					onClose={vi.fn()}
				/>
			)
			fireEvent.click(screen.getByRole('button', { name: /copy api key/i }))

			await screen.findByRole('button', { name: /api key copied/i })

			await act(async () => {
				vi.advanceTimersByTime(1600)
			})

			expect(
				screen.getByRole('button', { name: /copy api key/i })
			).not.toBeNull()
		} finally {
			vi.useRealTimers()
		}
	})

	it('keeps the key out of session replay', () => {
		/*
		  `entry.client.tsx` returns `$snapshot` events from `before_send`
		  unmodified, so replay applies no redaction of its own and this class is
		  the only thing between a live key and a recording.
		*/
		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={vi.fn()}
			/>
		)

		expect(
			screen.getByText(FIRST.plaintext).closest('.ph-no-capture')
		).not.toBeNull()
	})

	it('says when the key stops working', () => {
		/*
		  This value is about to be pasted into a production storefront. An embed
		  that dies in three months with no warning is the expensive version of
		  this conversation, so the expiry is stated at the one moment the user is
		  definitely looking.
		*/
		render(
			<OneTimeKeyDialog
				open
				apiKey={{ ...FIRST, expiresAt: EXPIRES_AT }}
				reason="created"
				onClose={vi.fn()}
			/>
		)

		expect(screen.getByText(/stops working on/i)).not.toBeNull()
	})

	it('says nothing about expiry for a key that never expires', () => {
		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={vi.fn()}
			/>
		)

		expect(screen.queryByText(/stops working on/i)).toBeNull()
	})
})
