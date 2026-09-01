// @vitest-environment jsdom
/**
 * The card's own refusal to copy a snippet that is no longer there.
 *
 * `EmbedOptionsPanel` stopped mounting this section before there is a key, so
 * the panel-level test of this guard could no longer fail: the menu it clicks
 * is unmounted with the section, and a detached element takes no click. The
 * guard has to be asserted where it lives.
 *
 * What it is for, now that the panel gate covers the revoked-key case: a caller
 * that mounts this card unready. `disabled` on a Radix menu item is
 * `aria-disabled` plus `pointer-events-none`, which stops a real pointer and
 * nothing else, so without the value guard `writeText('')` resolves and the
 * toast reports a snippet copied. The card is the last thing standing between
 * a wrong gate and an empty clipboard.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmbedSnippetCard } from '../app/components/embed/embed-snippet-card'
import { EMBED_COPY } from '../app/lib/domain/embed/embed-snippet'

globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

const writeText = vi.fn((_text: string) => Promise.resolve())
Object.defineProperty(navigator, 'clipboard', {
	value: { writeText },
	configurable: true
})

vi.mock('sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() }
}))

const CODE = {
	html: '<iframe src="https://vectreal.com/embed/p/s?token=abc"></iframe>',
	sdk: 'new VectrealEmbed.VectrealEmbed(el)',
	url: 'https://vectreal.com/embed/p/s?token=abc'
}

const EMPTY = { html: '', sdk: '', url: '' }

beforeEach(() => {
	writeText.mockClear()
})

const openCopyMenu = () => {
	fireEvent.pointerDown(
		screen.getByRole('button', {
			name: new RegExp(EMBED_COPY.copyOptions, 'i')
		}),
		new MouseEvent('pointerdown', { bubbles: true, button: 0 })
	)

	return screen.getAllByRole('menuitem')
}

describe('the copy guard', () => {
	it('copies what it is showing while the code is live', () => {
		render(<EmbedSnippetCard code={CODE} ready onTest={vi.fn()} />)

		fireEvent.click(screen.getByRole('button', { name: EMBED_COPY.copyHtml }))

		expect(writeText).toHaveBeenCalledTimes(1)
		expect(writeText.mock.calls[0][0]).toBe(CODE.html)
	})

	it('copies the view a menu item names, without leaving the tab', () => {
		/*
		  The only positive assertion in this file used to go through the split
		  button, so `onClick={() => copyView(candidate)}` on the menu items could
		  be replaced with a no-op and all three tests stayed green - a file about
		  the menu-item guard that never proved a menu item was wired to anything.
		*/
		render(<EmbedSnippetCard code={CODE} ready onTest={vi.fn()} />)

		const items = openCopyMenu()
		const copyUrl = items.find((item) =>
			item.textContent?.includes(EMBED_COPY.copyUrl)
		)
		fireEvent.click(copyUrl as HTMLElement)

		expect(writeText).toHaveBeenCalledTimes(1)
		expect(writeText.mock.calls[0][0]).toBe(CODE.url)
	})

	it('refuses a menu item whose snippet emptied under it', () => {
		const view = render(<EmbedSnippetCard code={CODE} ready onTest={vi.fn()} />)

		const items = openCopyMenu()

		act(() => {
			view.rerender(
				<EmbedSnippetCard code={EMPTY} ready={false} onTest={vi.fn()} />
			)
		})

		/*
		  Still in the document, unlike the panel-level version of this test: a
		  detached element takes no click, and a test that passes for that reason
		  says nothing about the guard.
		*/
		expect(items[0].isConnected).toBe(true)

		/*
		  Clicked directly, past `pointer-events-none`, which is the only way to
		  reach the state the guard is for.
		*/
		fireEvent.click(items[0])

		expect(writeText).not.toHaveBeenCalled()
	})

	it('draws no empty frame when it is not ready', () => {
		/*
		  The `min-h-20` spacer that used to render here held open the height of a
		  frame that was permanently on screen. Nothing is permanently on screen
		  now, so a caller that mounts this unready gets no box rather than an
		  empty one.
		*/
		render(<EmbedSnippetCard code={EMPTY} ready={false} onTest={vi.fn()} />)

		expect(document.querySelector('pre')).toBeNull()
		expect(
			screen.getByRole('button', { name: EMBED_COPY.copyHtml })
		).toHaveProperty('disabled', true)
	})
})
