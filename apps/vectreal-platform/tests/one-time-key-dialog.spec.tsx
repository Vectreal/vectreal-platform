// @vitest-environment jsdom
/**
 * The guard on an unrecoverable value, for the dashboard's copy of this dialog.
 *
 * `tests/embed-created-key-dialog.spec.tsx` already asserts the same rules for
 * the embed panel's dialog. That the two exist at all is the duplication this
 * work is about; until they are merged, both need the guard, because the bug
 * they prevent - dismissing a plaintext that was never copied, which cannot be
 * shown again - was fixed in one of them and not the other.
 *
 * Rotation is what made it reachable: repeating it is two clicks and a round
 * trip, well inside the two-second window the copy button stays lit.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
			<OneTimeKeyDialog
				open
				apiKey={null}
				reason="created"
				onClose={vi.fn()}
			/>
		)

		expect(screen.queryByText(FIRST.plaintext)).toBeNull()
	})

	it('asks before dismissing a key that was never copied', () => {
		const confirm = confirmWith(false)
		const onClose = vi.fn()

		render(
			<OneTimeKeyDialog open apiKey={FIRST} reason="created" onClose={onClose} />
		)
		dismiss()

		expect(confirm).toHaveBeenCalledOnce()
		expect(onClose).not.toHaveBeenCalled()
	})

	it('does not ask once the key has been copied', async () => {
		const confirm = confirmWith(true)
		const onClose = vi.fn()

		render(
			<OneTimeKeyDialog open apiKey={FIRST} reason="created" onClose={onClose} />
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
			<OneTimeKeyDialog open apiKey={FIRST} reason="rotated" onClose={onClose} />
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
			<OneTimeKeyDialog open apiKey={FIRST} reason="rotated" onClose={vi.fn()} />
		)

		expect(screen.getByText(/previous key stopped working/i)).not.toBeNull()
		expect(screen.getByText(/every embed still carrying it/i)).not.toBeNull()
	})

	it('does not tell a creating user anything about a previous key', () => {
		render(
			<OneTimeKeyDialog open apiKey={FIRST} reason="created" onClose={vi.fn()} />
		)

		expect(screen.queryByText(/previous key stopped working/i)).toBeNull()
	})
})
