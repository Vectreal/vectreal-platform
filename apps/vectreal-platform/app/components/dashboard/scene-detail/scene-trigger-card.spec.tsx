// @vitest-environment jsdom
/**
 * A door, drawn so it reads as one.
 *
 * The scene detail surfaces are either a statement of fact or a way into
 * something. The second kind used to be a `Button` in the header's action
 * stack, which made it the fourth call to action on a page with two, and said
 * nothing about what it opened. The summary line is what makes it a surface
 * rather than a button wearing a card, so it is what this file holds.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SceneTriggerCard } from './scene-trigger-card'

describe('the trigger card', () => {
	it('shows the label and what is behind it', () => {
		render(
			<SceneTriggerCard label="Publish & Embed" summary="Published · 27 Aug" />
		)

		const card = screen.getByRole('button')
		expect(card.textContent).toContain('Publish & Embed')
		/*
		  The summary is the whole reason this is a card. Dropping it leaves a
		  labelled button, which is what this replaced.
		*/
		expect(card.textContent).toContain('Published · 27 Aug')
	})

	it('is one button, so it is one stop and one accessible name', () => {
		render(<SceneTriggerCard label="Scene details" summary="7 assets" />)

		const card = screen.getByRole('button', { name: /scene details/i })
		expect(card.tagName).toBe('BUTTON')
		/*
		  `type="button"`. Inside a form - and the metadata editor above it is one -
		  a button with no type defaults to submit.
		*/
		expect(card.getAttribute('type')).toBe('button')
	})

	it('invokes on click and on the keyboard', () => {
		const onClick = vi.fn()
		render(
			<SceneTriggerCard
				label="Scene details"
				summary="7 assets"
				onClick={onClick}
			/>
		)

		const card = screen.getByRole('button')
		fireEvent.click(card)
		expect(onClick).toHaveBeenCalledTimes(1)

		/*
		  A real `button`, so Enter and Space are the browser's job rather than
		  handlers of our own - which is exactly why this is not a div with a click
		  listener. Asserting the click path plus the element is what pins that
		  choice; a div would pass the first assertion and fail this one.
		*/
		card.focus()
		expect(document.activeElement).toBe(card)
	})
})
