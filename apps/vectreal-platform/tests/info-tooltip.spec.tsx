// @vitest-environment jsdom
/**
 * The reason this component has a button in it.
 *
 * Radix's `TooltipTrigger` is a `Primitive.button` that adds no tabIndex of
 * its own, so under `asChild` it merges onto whatever it is handed. It used to
 * be handed the lucide `<svg>` directly, and an `<svg>` is not a tab stop:
 * every InfoTooltip in the app was unreachable by keyboard, and its content
 * never entered the accessibility tree, because Radix only sets
 * `aria-describedby` while the tooltip is open.
 */

import { act, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { InfoTooltip } from '../app/components/info-tooltip'

beforeAll(() => {
	// Radix's popper measures the trigger with a ResizeObserver, which jsdom
	// does not implement. Without this the content throws on open and React
	// unmounts the whole tree, so every assertion below reads an empty body.
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
})

const focusTrigger = async (trigger: HTMLElement) => {
	await act(async () => {
		trigger.focus()
	})
}

describe('InfoTooltip', () => {
	it('exposes a focusable trigger with an accessible name', async () => {
		render(<InfoTooltip content="Domains allowed to embed this scene." />)

		const trigger = screen.getByRole('button', { name: 'More information' })
		await focusTrigger(trigger)

		expect(document.activeElement).toBe(trigger)
		// A tab stop nobody can see is the same bug wearing a different hat.
		expect(trigger.className).toContain('focus-visible:ring-2')
	})

	it('describes the trigger with the tooltip content once focused', async () => {
		render(<InfoTooltip content="Domains allowed to embed this scene." />)

		const trigger = screen.getByRole('button', { name: 'More information' })
		await focusTrigger(trigger)

		const describedBy = trigger.getAttribute('aria-describedby')

		expect(describedBy).toBeTruthy()
		expect(document.getElementById(describedBy!)?.textContent).toBe(
			'Domains allowed to embed this scene.'
		)
	})

	it('keeps the icon out of the accessibility tree so the name is the button’s', () => {
		render(<InfoTooltip content="Help." className="size-3.5" />)

		const icon = screen
			.getByRole('button', { name: 'More information' })
			.querySelector('svg')!

		expect(icon).toHaveAttribute('aria-hidden', 'true')
		expect(icon.getAttribute('class')).toContain('size-3.5')
	})
})
