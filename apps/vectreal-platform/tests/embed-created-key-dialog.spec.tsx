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
		render(<EmbedCreatedKeyDialog plaintext={null} onDismiss={vi.fn()} />)

		expect(screen.queryByText(PLAINTEXT)).toBeNull()
	})

	it('renders the key so it can be read and copied', async () => {
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} onDismiss={vi.fn()} />)

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
		const { container } = render(
			<EmbedCreatedKeyDialog plaintext={PLAINTEXT} onDismiss={vi.fn()} />
		)
		const block = screen.getByText(PLAINTEXT)

		expect(block.closest('.ph-no-capture')).not.toBeNull()
		expect(container).toBeDefined()
	})

	it('asks before closing when the key has not been copied', () => {
		const confirm = confirmWith(false)
		const onDismiss = vi.fn()
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} onDismiss={onDismiss} />)

		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(confirm).toHaveBeenCalled()
		expect(onDismiss).not.toHaveBeenCalled()
	})

	it('closes when the user confirms they accept losing it', () => {
		confirmWith(true)
		const onDismiss = vi.fn()
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} onDismiss={onDismiss} />)

		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it('closes without asking once the key has been copied', async () => {
		const confirm = confirmWith(false)
		const onDismiss = vi.fn()
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} onDismiss={onDismiss} />)

		fireEvent.click(screen.getByRole('button', { name: /copy key/i }))
		await screen.findByRole('button', { name: /^copied$/i })

		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(confirm).not.toHaveBeenCalled()
		expect(onDismiss).toHaveBeenCalledTimes(1)
	})

	it('does not let Escape bypass the question', () => {
		const confirm = confirmWith(false)
		const onDismiss = vi.fn()
		render(<EmbedCreatedKeyDialog plaintext={PLAINTEXT} onDismiss={onDismiss} />)

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
			<EmbedCreatedKeyDialog plaintext={PLAINTEXT} onDismiss={onDismiss} />
		)

		fireEvent.click(screen.getByRole('button', { name: /copy key/i }))
		await screen.findByRole('button', { name: /^copied$/i })
		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		rerender(<EmbedCreatedKeyDialog plaintext={null} onDismiss={onDismiss} />)
		rerender(
			<EmbedCreatedKeyDialog plaintext="vctrl_second9zQ1" onDismiss={onDismiss} />
		)

		confirm.mockClear()
		fireEvent.click(screen.getByRole('button', { name: /^done$/i }))

		expect(confirm).toHaveBeenCalled()
	})
})
