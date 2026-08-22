// @vitest-environment jsdom
/**
 * The guard on an unrecoverable value.
 *
 * A key is stored hashed, so the plaintext this dialog shows exists nowhere
 * else and cannot be fetched again. Everything asserted here is about not
 * losing it: that dismissing without copying asks first, that Escape cannot
 * slip past that question, and that a later key does not inherit the previous
 * one's "copied" state and skip the check.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EmbedCreatedKeyDialog } from '../app/components/embed/embed-created-key-dialog'

const PLAINTEXT = 'vctrl_secretvalueab3x'
const EXPIRES_AT = '2026-11-20T00:00:00.000Z'

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

describe('EmbedCreatedKeyDialog', () => {
	it('shows nothing until a key exists', () => {
		render(<EmbedCreatedKeyDialog plaintext={null} expiresAt={EXPIRES_AT} onDismiss={vi.fn()} />)

		expect(screen.queryByText(PLAINTEXT)).toBeNull()
	})

	it('says when the key stops working', () => {
		/*
		  This value is about to be pasted into a production storefront. An embed
		  that dies in three months with no warning is the expensive version of
		  this conversation, so the expiry is stated at the one moment the user is
		  definitely looking.
		*/
		render(
			<EmbedCreatedKeyDialog
				plaintext={PLAINTEXT}
				expiresAt={EXPIRES_AT}
				onDismiss={vi.fn()}
			/>
		)

		expect(screen.getByText(/stops working on/i)).not.toBeNull()
	})

	it('says nothing about expiry for a key that never expires', () => {
		render(
			<EmbedCreatedKeyDialog
				plaintext={PLAINTEXT}
				expiresAt={null}
				onDismiss={vi.fn()}
			/>
		)

		expect(screen.queryByText(/stops working on/i)).toBeNull()
	})

	it('renders the key so it can be read and copied', async () => {
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} expiresAt={EXPIRES_AT} onDismiss={vi.fn()} />)

		expect(screen.getByText(PLAINTEXT)).not.toBeNull()

		fireEvent.click(screen.getByRole('button', { name: /copy key/i }))
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(PLAINTEXT))
	})

	it('keeps the key out of session replay', () => {
		/*
		  Replay masks input values by default but not text nodes, and this app
		  sets no `maskTextSelector` - so without this class the live key would be
		  readable in any recording of this dialog.
		*/
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} expiresAt={EXPIRES_AT} onDismiss={vi.fn()} />)

		expect(screen.getByText(PLAINTEXT).closest('.ph-no-capture')).not.toBeNull()
	})

	it('asks before closing when the key has not been copied', () => {
		const confirm = confirmWith(false)
		const onDismiss = vi.fn()
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} expiresAt={EXPIRES_AT} onDismiss={onDismiss} />)

		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(confirm).toHaveBeenCalled()
		expect(onDismiss).not.toHaveBeenCalled()
	})

	it('closes when the user confirms they accept losing it', () => {
		confirmWith(true)
		const onDismiss = vi.fn()
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} expiresAt={EXPIRES_AT} onDismiss={onDismiss} />)

		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it('closes without asking once the key has been copied', async () => {
		const confirm = confirmWith(false)
		const onDismiss = vi.fn()
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} expiresAt={EXPIRES_AT} onDismiss={onDismiss} />)

		fireEvent.click(screen.getByRole('button', { name: /copy key/i }))
		await screen.findByRole('button', { name: /^copied$/i })

		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(confirm).not.toHaveBeenCalled()
		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it('does not let Escape bypass the question', () => {
		const confirm = confirmWith(false)
		const onDismiss = vi.fn()
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} expiresAt={EXPIRES_AT} onDismiss={onDismiss} />)

		fireEvent.keyDown(document.activeElement ?? document.body, {
			key: 'Escape',
			code: 'Escape'
		})

		expect(onDismiss).not.toHaveBeenCalled()
		expect(confirm).not.toHaveBeenCalled()
		expect(screen.getByText(PLAINTEXT)).not.toBeNull()
	})

	it('re-arms the question for the next key', async () => {
		/*
		  `copied` is what suppresses the confirmation. If it survived a dismissal,
		  the second key a user creates would close silently on the first click.
		*/
		const confirm = confirmWith(true)
		const onDismiss = vi.fn()
		const { rerender } = render(
			<EmbedCreatedKeyDialog plaintext={PLAINTEXT} expiresAt={EXPIRES_AT} onDismiss={onDismiss} />
		)

		fireEvent.click(screen.getByRole('button', { name: /copy key/i }))
		await screen.findByRole('button', { name: /^copied$/i })
		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		rerender(<EmbedCreatedKeyDialog plaintext={null} expiresAt={EXPIRES_AT} onDismiss={onDismiss} />)
		rerender(
			<EmbedCreatedKeyDialog plaintext="vctrl_second9zQ1" expiresAt={EXPIRES_AT} onDismiss={onDismiss} />
		)

		confirm.mockClear()
		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(confirm).toHaveBeenCalled()
	})
})
