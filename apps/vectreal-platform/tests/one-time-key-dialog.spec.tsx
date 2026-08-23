// @vitest-environment jsdom
/**
 * The guard on an unrecoverable value.
 *
 * One dialog, so one spec. The embed panel used to render its own, with its own
 * spec, and each caught a rule the other did not: this one that a second key
 * cannot inherit the first one's copied state, that one that the plaintext is
 * marked `ph-no-capture` and that Escape cannot slip past the copy check.
 * Every assertion both files carried is carried here.
 *
 * Rotation is what made the copied-state bug reachable: repeating it is two
 * clicks and a round trip, well inside the two-second window the copy button
 * stays lit.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	OneTimeKeyDialog,
	type OneTimeKeyValue
} from '../app/components/api-keys/one-time-key-dialog'

const FIRST: OneTimeKeyValue = {
	plaintext: 'vctrl_firstsecretab3x',
	preview: 'ab3x',
	name: 'Storefront key'
}

const EXPIRES_AT = '2026-11-20T00:00:00.000Z'

const SECOND: OneTimeKeyValue = {
	plaintext: 'vctrl_secondsecret9zQ1',
	preview: '9zQ1',
	name: 'Storefront key'
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

const confirmWith = (answer: boolean) =>
	vi.spyOn(window, 'confirm').mockReturnValue(answer)

const dismiss = () =>
	fireEvent.click(screen.getByRole('button', { name: /saved my key/i }))

describe('OneTimeKeyDialog', () => {
	it('shows nothing until a key exists', () => {
		render(
			<OneTimeKeyDialog open apiKey={null} reason="created" onClose={vi.fn()} />
		)

		expect(screen.queryByText(FIRST.plaintext)).toBeNull()
	})

	it('asks before dismissing a key that was never copied', () => {
		const confirm = confirmWith(false)
		const onClose = vi.fn()

		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={onClose}
			/>
		)
		dismiss()

		expect(confirm).toHaveBeenCalledOnce()
		expect(onClose).not.toHaveBeenCalled()
	})

	it('closes when the user accepts losing an uncopied key', () => {
		/*
		  The other half of the confirmation. Every other test here answers it
		  with a copy already made, so without this one the `confirmed === true`
		  fall-through in `handleClose` is never executed and a dialog that
		  refused to close on "yes" would pass the suite.
		*/
		const confirm = confirmWith(true)
		const onClose = vi.fn()

		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={onClose}
			/>
		)
		dismiss()

		expect(confirm).toHaveBeenCalledOnce()
		expect(onClose).toHaveBeenCalledOnce()
	})

	it('does not ask once the key has been copied', async () => {
		const confirm = confirmWith(true)
		const onClose = vi.fn()

		render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="created"
				onClose={onClose}
			/>
		)
		fireEvent.click(screen.getByRole('button', { name: /copy api key/i }))
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(FIRST.plaintext))

		dismiss()

		expect(confirm).not.toHaveBeenCalled()
		expect(onClose).toHaveBeenCalledOnce()
	})

	/*
	  The regression this file exists for. The parent renders this component
	  continuously and only swaps `apiKey`, so nothing remounts it between keys
	  and `copied` survives - along with the 2s window in which the button still
	  reads as copied.
	*/
	it('does not let a second key inherit the first key’s copied state', async () => {
		const onClose = vi.fn()
		const { rerender } = render(
			<OneTimeKeyDialog
				open
				apiKey={FIRST}
				reason="rotated"
				onClose={onClose}
			/>
		)

		fireEvent.click(screen.getByRole('button', { name: /copy api key/i }))
		await waitFor(() => expect(writeText).toHaveBeenCalledWith(FIRST.plaintext))

		// A second rotation, well within the copied-state timeout.
		rerender(
			<OneTimeKeyDialog
				open
				apiKey={SECOND}
				reason="rotated"
				onClose={onClose}
			/>
		)
		await screen.findByText(SECOND.plaintext)

		const confirm = confirmWith(false)
		dismiss()

		expect(
			confirm,
			'the second key was never copied, so dismissing it must ask first'
		).toHaveBeenCalledOnce()
		expect(onClose).not.toHaveBeenCalled()
	})

	it('tells a rotating user that the old key is already dead', () => {
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

	it('still counts the key as copied after the button stops saying so', async () => {
		/*
		  The button's checkmark reverts after two seconds so the control reads as
		  pressable again. That timer used to clear the record of the copy along
		  with it, so anyone who spent longer than two seconds pasting the key was
		  asked, on close, whether they had copied it - having just done so.
		*/
		vi.useFakeTimers({ shouldAdvanceTime: true })
		try {
			const confirm = confirmWith(true)
			const onClose = vi.fn()

			render(
				<OneTimeKeyDialog
					open
					apiKey={FIRST}
					reason="created"
					onClose={onClose}
				/>
			)
			fireEvent.click(screen.getByRole('button', { name: /copy api key/i }))
			await waitFor(() =>
				expect(writeText).toHaveBeenCalledWith(FIRST.plaintext)
			)

			await act(async () => {
				vi.advanceTimersByTime(3000)
			})
			dismiss()

			expect(confirm).not.toHaveBeenCalled()
			expect(onClose).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})

	it('reports the copy on the control itself, then takes it back', async () => {
		/*
		  The checkmark is the only feedback the copy gives, and it reverts after
		  two seconds so the button reads as pressable again. Nothing else in this
		  file looks at it: with the label held constant, the flash state could be
		  deleted outright and every other test here would still pass.
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
				vi.advanceTimersByTime(2100)
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
		  Replay masks input values by default but not text nodes, and this app
		  sets no `maskTextSelector` - so without this class the live key would be
		  readable in any recording of this dialog.
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

	it('does not let Escape bypass the question', () => {
		const confirm = confirmWith(false)
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

		expect(onClose).not.toHaveBeenCalled()
		expect(confirm).not.toHaveBeenCalled()
		expect(screen.getByText(FIRST.plaintext)).not.toBeNull()
	})
})
